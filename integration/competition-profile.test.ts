import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/auth", () => ({ auth: async () => identity.userId ? { user: { id: identity.userId } } : null }));

import { saveCompProfile } from "@/app/actions/comp";
import { applyToCompetitions, withdrawTeamApplication } from "@/app/actions/team";
import { saveCompetitionPacketLink } from "@/app/actions/competition-packet";
import { GET as downloadPacket } from "@/app/api/competitions/[id]/packet/route";
import { resetCompClaim, softResetCompClaim } from "@/app/actions/team-access";
import { prisma } from "@/lib/prisma";
import { E2E, seedE2E } from "../prisma/e2e-seed";

beforeEach(async () => { identity.userId = ""; await seedE2E(); });
afterAll(async () => { await prisma.$disconnect(); });

function detailsForm(stageSize: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    eventDatesTbd: "on",
    location: "Test City",
    venue: "N/A",
    stageSize,
    lighting: "TBD",
    productionNotes: "N/A",
    description: "Fixture competition details",
    earlyApplicationDeadline: "",
    applicationDeadline: "",
    acceptingApps: "on",
  })) data.set(key, value);
  return data;
}

it("keeps an incomplete competition hidden and rejects a direct application until details are complete", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const teamUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
  const compUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { stageSize: "", acceptingApps: true, applicationDeadline: null },
  });
  const selection = new FormData();
  selection.append("competitionId", competition.id);

  identity.userId = teamUser.id;
  expect(await applyToCompetitions(undefined, selection)).toHaveProperty("error");
  expect(await prisma.application.count({ where: { competitionId: competition.id, team: { slug: E2E.teams.mine.slug } } })).toBe(0);

  identity.userId = compUser.id;
  expect(await saveCompProfile(undefined, detailsForm(""))).toMatchObject({ ok: true, message: expect.stringContaining("hidden from teams") });
  expect(await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } })).toMatchObject({ acceptingApps: false });
  expect(await saveCompProfile(undefined, detailsForm("40 x 32 feet"))).toMatchObject({ ok: true, message: expect.stringContaining("applications are open") });

  identity.userId = teamUser.id;
  expect(await applyToCompetitions(undefined, selection)).toMatchObject({ ok: true });
  expect(await prisma.application.count({ where: { competitionId: competition.id, team: { slug: E2E.teams.mine.slug } } })).toBe(1);
});

async function host() {
  identity.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } })).id;
  return prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
}

it("saves calendar dates, exact fees, address and payment instructions; preserves legacy copy", async () => {
  const comp = await host();
  const data = detailsForm("40 x 32 feet");
  data.delete("eventDatesTbd");
  data.set("eventStartDate", "2027-03-05");
  data.set("eventEndDate", "2027-03-07");
  data.set("regularApplicationFee", "35.29");
  data.set("lateApplicationFee", "0");
  data.set("venueAddress", "123 Example Street\nAtlanta, GA 30301");
  data.set("paymentInstructions", "Pay https://example.com/payment and include your team name.");
  expect(await saveCompProfile(undefined, data)).toHaveProperty("ok", true);
  const saved = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } });
  expect(saved).toMatchObject({
    eventStartDate: new Date("2027-03-05T00:00:00Z"), eventEndDate: new Date("2027-03-07T00:00:00Z"),
    regularApplicationFeeCents: 3529, lateApplicationFeeCents: 0,
    venueAddress: "123 Example Street\nAtlanta, GA 30301", paymentInstructions: data.get("paymentInstructions"),
    lighting: "TBD", description: "Fixture competition details",
  });
  expect(saved.dates).toMatch(/Mar.*5.*7.*2027/);
  data.set("eventEndDate", "2027-03-04");
  expect(await saveCompProfile(undefined, data)).toHaveProperty("error");
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).eventEndDate).toEqual(saved.eventEndDate);
  data.set("eventEndDate", "");
  data.set("regularApplicationFee", "-5");
  expect(await saveCompProfile(undefined, data)).toHaveProperty("error");
  data.set("regularApplicationFee", "");
  expect(await saveCompProfile(undefined, data)).toHaveProperty("ok", true);
  expect(await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).toMatchObject({ regularApplicationFeeCents: null, eventEndDate: saved.eventStartDate });
  data.set("eventDatesTbd", "on");
  expect(await saveCompProfile(undefined, data)).toHaveProperty("ok", true);
  expect(await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).toMatchObject({ dates: "TBD", eventStartDate: null, eventEndDate: null });
});

it("retains existing free-text dates when a host only edits another detail", async () => {
  const comp = await host();
  const data = detailsForm("Updated stage");
  data.delete("eventDatesTbd");
  expect(await saveCompProfile(undefined, data)).toHaveProperty("ok", true);
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).dates).toBe(comp.dates);
});

it("saves an optional Early period and snapshots phase and fee when a team applies", async () => {
  const comp = await host();
  const data = detailsForm("40 x 32 feet");
  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const earlyAt = future(1);
  const regularAt = future(2);
  const lateAt = future(3);
  data.set("earlyTierDeadline", earlyAt);
  data.set("earlyApplicationDeadline", regularAt);
  data.set("applicationDeadline", lateAt);
  data.set("earlyApplicationFee", "25.00");
  data.set("regularApplicationFee", "35.00");
  data.set("lateApplicationFee", "45.00");
  expect(await saveCompProfile(undefined, data)).toMatchObject({ ok: true });
  const saved = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } });
  expect(saved.earlyApplicationFeeCents).toBe(2500);
  expect(saved.applicationClosesAt).toEqual(new Date(lateAt));

  const teamUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
  identity.userId = teamUser.id;
  const selection = new FormData();
  selection.append("competitionId", comp.id);
  expect(await applyToCompetitions(undefined, selection)).toMatchObject({ ok: true });
  const application = await prisma.application.findFirstOrThrow({
    where: { competitionId: comp.id, team: { slug: E2E.teams.mine.slug } },
  });
  expect(application).toMatchObject({ appliedPhase: "EARLY", expectedFeeCents: 2500 });

  identity.userId = saved.userId!;
  data.set("earlyApplicationFee", "30.00");
  expect(await saveCompProfile(undefined, data)).toMatchObject({ ok: true });
  expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({
    appliedPhase: "EARLY", expectedFeeCents: 2500,
  });
  data.set("earlyTierDeadline", future(4));
  expect(await saveCompProfile(undefined, data)).toHaveProperty("error");
});

it("saves each application's AV and lets its own team withdraw only while applications are open", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.open.slug } });
  const team = await prisma.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } });
  const teamUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
  const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  const apply = new FormData(); apply.set("competitionId", competition.id);
  identity.userId = teamUser.id;
  expect(await applyToCompetitions(undefined, apply)).toMatchObject({ ok: true });
  const application = await prisma.application.findFirstOrThrow({ where: { teamId: team.id, competitionId: competition.id } });
  expect(application.submittedAvDriveUrl).toBe(team.avDriveUrl);

  const changedLink = "https://drive.google.com/file/d/1LpayQ7KwPVdYpaQ6gr6FyqC8r71LZke6/view";
  await prisma.teamProfile.update({ where: { id: team.id }, data: { avDriveUrl: changedLink } });
  expect((await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).submittedAvDriveUrl).toBe(team.avDriveUrl);

  const withdraw = new FormData(); withdraw.set("applicationId", application.id);
  identity.userId = otherUser.id;
  expect(await withdrawTeamApplication(undefined, withdraw)).toHaveProperty("error");
  identity.userId = teamUser.id;
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { acceptingApps: false } });
  expect(await withdrawTeamApplication(undefined, withdraw)).toHaveProperty("error");
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { acceptingApps: true } });
  expect(await withdrawTeamApplication(undefined, withdraw)).toMatchObject({ ok: true });
  expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({
    submittedAvDriveUrl: team.avDriveUrl,
    removalReason: "Withdrawn by team",
    removedAt: expect.any(Date),
  });
  expect(await prisma.application.count({ where: { competitionId: competition.id, removedAt: null } })).toBe(0);
  expect(await applyToCompetitions(undefined, apply)).toMatchObject({ ok: true, message: expect.stringContaining("cannot be resubmitted") });
  expect(await withdrawTeamApplication(undefined, withdraw)).toHaveProperty("error");
});

const driveId = "1EvaXITNNCUf_u22R0gHwSxW7ytge3zaX";
const driveUrl = `https://drive.google.com/file/d/${driveId}/view`;
function packetForm(url = driveUrl) {
  const data = new FormData();
  data.set("packetDriveUrl", url);
  return data;
}

it("authorizes packet links, validates them, and preserves legacy PDFs during the rollout", async () => {
  const comp = await host();
  const hostId = identity.userId;
  await prisma.competitionProfile.update({ where: { id: comp.id }, data: { stageSize: "" } });
  identity.userId = "";
  expect(await saveCompetitionPacketLink(undefined, packetForm())).toHaveProperty("error");
  identity.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } })).id;
  expect(await saveCompetitionPacketLink(undefined, packetForm())).toHaveProperty("error");
  const context = { params: Promise.resolve({ id: comp.id }) };
  const request = new Request(`http://localhost/api/competitions/${comp.id}/packet`);
  identity.userId = hostId;
  await prisma.competitionPacketBlob.create({ data: { competitionId: comp.id, filename: "application.pdf", bytes: Buffer.from("%PDF-1.7\nfixture\n%%EOF\n") } });
  const ownDownload = await downloadPacket(request, context);
  expect(ownDownload.status).toBe(200);
  expect(ownDownload.headers.get("Content-Disposition")).toBe('attachment; filename="application.pdf"');
  identity.userId = "";
  expect((await downloadPacket(request, context)).status).toBe(404);
  await prisma.competitionProfile.update({ where: { id: comp.id }, data: { stageSize: "N/A" } });
  expect((await downloadPacket(request, context)).status).toBe(200);
  identity.userId = hostId;
  expect(await saveCompetitionPacketLink(undefined, packetForm("https://example.com/packet.pdf"))).toHaveProperty("error");
  expect((await downloadPacket(request, context)).status).toBe(200);
  expect(await saveCompetitionPacketLink(undefined, packetForm(`${driveUrl}?usp=sharing`))).toHaveProperty("ok", true);
  expect(await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).toMatchObject({ applicationPacketDriveUrl: driveUrl, applicationPacketLegacyHidden: true });
  expect((await downloadPacket(request, context)).status).toBe(404);
  expect(await prisma.competitionPacketBlob.count({ where: { competitionId: comp.id } })).toBe(1);
  // A supplied competition ID cannot override the authenticated active competition.
  const other = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.open.slug } });
  const forged = packetForm(); forged.set("competitionId", other.id);
  await saveCompetitionPacketLink(undefined, forged);
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: other.id } })).applicationPacketDriveUrl).toBeNull();
  const remove = new FormData(); remove.set("intent", "remove");
  identity.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
  expect(await saveCompetitionPacketLink(undefined, remove)).toHaveProperty("error");
  identity.userId = hostId;
  expect(await saveCompetitionPacketLink(undefined, remove)).toHaveProperty("ok", true);
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).applicationPacketDriveUrl).toBeNull();
  expect((await downloadPacket(request, context)).status).toBe(404);
});

it("preserves new host details on a soft reset and clears them on a full reset", async () => {
  const comp = await host();
  await prisma.competitionProfile.update({ where: { id: comp.id }, data: {
    venueAddress: "123 Example St", regularApplicationFeeCents: 2000, lateApplicationFeeCents: 3000,
    paymentInstructions: "Contact the host", eventStartDate: new Date("2027-03-05"), eventEndDate: new Date("2027-03-06"),
  } });
  await saveCompetitionPacketLink(undefined, packetForm());
  identity.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
  const form = new FormData(); form.set("competitionId", comp.id);
  expect(await softResetCompClaim(undefined, form)).toHaveProperty("ok", true);
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).applicationPacketDriveUrl).toBe(driveUrl);
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).venueAddress).toBe("123 Example St");
  expect(await resetCompClaim(undefined, form)).toHaveProperty("ok", true);
  expect(await prisma.competitionPacketBlob.count({ where: { competitionId: comp.id } })).toBe(0);
  expect(await prisma.competitionProfile.findUniqueOrThrow({ where: { id: comp.id } })).toMatchObject({ applicationPacketDriveUrl: null, applicationPacketLegacyHidden: false, venueAddress: "", regularApplicationFeeCents: null, lateApplicationFeeCents: null, paymentInstructions: "", eventStartDate: null, eventEndDate: null });
});
