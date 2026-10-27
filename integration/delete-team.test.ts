import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { E2E, seedE2E } from "../prisma/e2e-seed";
import { deleteTeam } from "@/app/actions/team-access";
import { ensureCompetitionJudgeSlots } from "@/lib/judging";
import { prisma } from "@/lib/prisma";

beforeEach(async () => { await seedE2E(); identity.userId = ""; });
afterAll(async () => { await prisma.$disconnect(); });

function deletion(teamId: string, name: string, claimCode: string) {
  const data = new FormData();
  data.set("teamId", teamId);
  data.set("teamName", name);
  data.set("claimCode", claimCode);
  data.set("confirmation", "DELETE");
  data.set("reason", "Duplicate listing");
  return data;
}

it("restricts team deletion to tech admins and removes only that team's data after strong confirmation", async () => {
  const team = await prisma.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.alpha.slug } });
  const otherTeam = await prisma.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.beta.slug } });
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const teamAdmin = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });

  await prisma.teamMembership.create({ data: { teamId: team.id, userId: teamAdmin.id, status: "APPROVED", isAdmin: true } });
  await prisma.teamInvite.create({ data: { teamId: team.id, email: "invite@example.org" } });
  await prisma.teamPhotoBlob.create({ data: { teamId: team.id, bytes: Buffer.from("test"), mime: "image/png" } });

  identity.userId = teamAdmin.id;
  expect(await deleteTeam(undefined, deletion(team.id, team.name, team.claimCode))).toHaveProperty("error");
  identity.userId = tech.id;
  expect(await deleteTeam(undefined, deletion(team.id, "Wrong name", team.claimCode))).toHaveProperty("error");
  expect(await deleteTeam(undefined, deletion(team.id, team.name, otherTeam.claimCode))).toHaveProperty("error");
  const noReason = deletion(team.id, team.name, team.claimCode);
  noReason.set("reason", "");
  expect(await deleteTeam(undefined, noReason)).toHaveProperty("error");

  await ensureCompetitionJudgeSlots(competition.id);
  const slots = await prisma.judgeViewingSlot.findMany({
    where: { assignment: { competitionId: competition.id } },
    include: { application: { select: { teamId: true } } },
  });
  for (const slot of slots) {
    await prisma.judgeScore.create({ data: { slotId: slot.id, assignmentId: slot.assignmentId, choreography: 8 } });
  }
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { judgingOpen: true } });
  expect(await deleteTeam(undefined, deletion(team.id, team.name, team.claimCode))).toHaveProperty("error");
  expect(await prisma.teamProfile.findUnique({ where: { id: team.id } })).not.toBeNull();
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { judgingOpen: false, resultsReleasedAt: new Date() } });

  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(await deleteTeam(undefined, deletion(team.id, team.name, team.claimCode))).toMatchObject({ ok: true });
  expect(log).toHaveBeenCalledWith("Team deleted", expect.objectContaining({
    teamId: team.id,
    actorEmail: tech.email,
    reason: "Duplicate listing",
    hadReleasedResults: true,
  }));
  expect(await prisma.teamProfile.findUnique({ where: { id: team.id } })).toBeNull();
  expect(await prisma.application.count({ where: { teamId: team.id } })).toBe(0);
  expect(await prisma.teamMembership.count({ where: { teamId: team.id } })).toBe(0);
  expect(await prisma.teamInvite.count({ where: { teamId: team.id } })).toBe(0);
  expect(await prisma.teamPhotoBlob.count({ where: { teamId: team.id } })).toBe(0);
  expect(await prisma.judgeScore.count({ where: { slot: { application: { teamId: team.id } } } })).toBe(0);
  expect(await prisma.competitionProfile.findUnique({ where: { id: competition.id } })).not.toBeNull();
  expect(await prisma.teamProfile.findUnique({ where: { id: otherTeam.id } })).not.toBeNull();
  expect(await prisma.application.count({ where: { teamId: otherTeam.id } })).toBe(1);
  expect(await prisma.judgeScore.count({ where: { slot: { application: { teamId: otherTeam.id } } } })).toBe(1);
  expect(await prisma.user.findUnique({ where: { id: teamAdmin.id } })).not.toBeNull();
  log.mockRestore();
});
