import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
}));
vi.mock("@/app/actions/auth", () => ({
  requireUser: async () => identity.user,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { E2E, seedE2E } from "../prisma/e2e-seed";
import {
  markAllRegistrationPaid,
  removeUnpaidApplication,
  setCompPaymentReceived,
  setRegistrationPaid,
} from "@/app/actions/payments";
import { ensureCompetitionJudgeSlots } from "@/lib/judging";
import { setJudgingOpen } from "@/app/actions/ops-judging";
import { hostPaymentFingerprint } from "@/lib/host-payment-review";
import { prisma } from "@/lib/prisma";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(async () => {
  await seedE2E();
  identity.user = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

it("lets only a tech admin mark every unpaid registration fee paid without changing host payments or existing receipts", async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  const outsider = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
  const unpaidTeam = await prisma.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.alpha.slug } });
  const alreadyPaidTeam = await prisma.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.beta.slug } });
  const unpaidCompetition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const application = await prisma.application.findFirstOrThrow({ select: { id: true, compPaymentReceivedAt: true } });

  await prisma.$transaction([
    prisma.teamProfile.update({ where: { id: unpaidTeam.id }, data: { registrationPaidAt: null, registrationPaidByEmail: null } }),
    prisma.competitionProfile.update({ where: { id: unpaidCompetition.id }, data: { registrationPaidAt: null, registrationPaidByEmail: null } }),
  ]);

  identity.user = { id: outsider.id, email: outsider.email };
  expect(await markAllRegistrationPaid(undefined, new FormData())).toHaveProperty("error");
  expect(await prisma.teamProfile.findUniqueOrThrow({ where: { id: unpaidTeam.id } })).toMatchObject({ registrationPaidAt: null });

  identity.user = { id: admin.id, email: admin.email };
  expect(await markAllRegistrationPaid(undefined, new FormData())).toMatchObject({ ok: true });
  expect(await prisma.teamProfile.count({ where: { registrationPaidAt: null } })).toBe(0);
  expect(await prisma.competitionProfile.count({ where: { registrationPaidAt: null } })).toBe(0);
  expect(await prisma.teamProfile.findUniqueOrThrow({ where: { id: unpaidTeam.id } })).toMatchObject({ registrationPaidByEmail: admin.email });
  expect(await prisma.competitionProfile.findUniqueOrThrow({ where: { id: unpaidCompetition.id } })).toMatchObject({ registrationPaidByEmail: admin.email });
  expect(await prisma.teamProfile.findUniqueOrThrow({ where: { id: alreadyPaidTeam.id } })).toMatchObject({ registrationPaidAt: alreadyPaidTeam.registrationPaidAt });
  expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({ compPaymentReceivedAt: application.compPaymentReceivedAt });
  expect(await markAllRegistrationPaid(undefined, new FormData())).toMatchObject({ ok: true, message: "All OneLegends registration fees are already marked paid." });
});

it("requires both OneLegends fees and freezes the first cleared viewing roster", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({
    where: { slug: E2E.comps.showcase.slug },
  });
  const alpha = await prisma.teamProfile.findUniqueOrThrow({
    where: { slug: E2E.teams.alpha.slug },
  });
  const beta = await prisma.teamProfile.findUniqueOrThrow({
    where: { slug: E2E.teams.beta.slug },
  });

  await prisma.competitionProfile.update({
    where: { id: competition.id },
    data: { registrationPaidAt: null },
  });
  await ensureCompetitionJudgeSlots(competition.id);
  expect(await prisma.application.count({
    where: { competitionId: competition.id, viewingPosition: { not: null } },
  })).toBe(0);

  await prisma.$transaction([
    prisma.competitionProfile.update({
      where: { id: competition.id },
      data: { registrationPaidAt: new Date() },
    }),
    prisma.teamProfile.update({
      where: { id: alpha.id },
      data: { registrationPaidAt: null },
    }),
  ]);
  await ensureCompetitionJudgeSlots(competition.id);

  const firstRoster = await prisma.application.findMany({
    where: { competitionId: competition.id, viewingPosition: { not: null } },
    select: { teamId: true },
  });
  expect(firstRoster.map((row) => row.teamId)).toEqual([beta.id]);

  await prisma.teamProfile.update({
    where: { id: alpha.id },
    data: { registrationPaidAt: new Date() },
  });
  await ensureCompetitionJudgeSlots(competition.id);
  expect(await prisma.application.findFirstOrThrow({
    where: { competitionId: competition.id, teamId: alpha.id },
  })).toMatchObject({ viewingPosition: null });
});

it("rejects payment and removal changes after the viewing roster is locked", async () => {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.tech },
  });
  identity.user = { id: admin.id, email: admin.email };
  const application = await prisma.application.findFirstOrThrow({
    where: { competition: { slug: E2E.comps.showcase.slug } },
    include: { team: true },
  });
  await ensureCompetitionJudgeSlots(application.competitionId);

  expect(await setRegistrationPaid(undefined, form({
    kind: "team",
    id: application.teamId,
    paid: "0",
  }))).toHaveProperty("error");
  expect(await removeUnpaidApplication(undefined, form({
    applicationId: application.id,
    reason: "No longer eligible",
  }))).toHaveProperty("error");

  expect(await prisma.teamProfile.findUniqueOrThrow({
    where: { id: application.teamId },
  })).toMatchObject({ registrationPaidAt: application.team.registrationPaidAt });
  expect(await prisma.application.findUniqueOrThrow({
    where: { id: application.id },
  })).toMatchObject({ removedAt: null });
});

it("lets the host track an applicant's payment before AV viewing without changing other data", async () => {
  const application = await prisma.application.findFirstOrThrow({
    where: { competition: { slug: E2E.comps.showcase.slug } },
    select: { id: true, competitionId: true, teamId: true, status: true },
  });
  const other = await prisma.application.findFirstOrThrow({
    where: { competitionId: application.competitionId, id: { not: application.id } },
    select: { id: true, compPaymentReceivedAt: true },
  });

  const outsider = await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.team },
  });
  identity.user = { id: outsider.id, email: outsider.email };
  expect(await setCompPaymentReceived(undefined, form({
    applicationId: application.id,
    received: "1",
  }))).toHaveProperty("error");

  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  identity.user = { id: tech.id, email: tech.email };
  expect(await setCompPaymentReceived(undefined, form({
    applicationId: application.id,
    received: "1",
  }))).toHaveProperty("error");

  const host = await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.comp },
  });
  identity.user = { id: host.id, email: host.email };
  expect(await setCompPaymentReceived(undefined, form({
    applicationId: application.id,
    received: "1",
  }))).toMatchObject({ ok: true });
  expect(await prisma.application.findUniqueOrThrow({
    where: { id: application.id },
  })).toMatchObject({
    teamId: application.teamId,
    status: application.status,
    compPaymentRecordedByEmail: host.email,
    compPaymentReceivedAt: expect.any(Date),
  });
  expect(await prisma.application.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({
    compPaymentReceivedAt: other.compPaymentReceivedAt,
  });
  expect(await setCompPaymentReceived(undefined, form({ applicationId: application.id, received: "0" }))).toMatchObject({ ok: true });
  expect(await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({
    compPaymentReceivedAt: null,
    compPaymentRecordedByEmail: null,
  });
});

it("requires the tech admin's current payment check and excludes host-unpaid teams from a new AV roster", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const applications = await prisma.application.findMany({ where: { competitionId: competition.id }, orderBy: { id: "asc" } });
  const host = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  identity.user = { id: host.id, email: host.email };
  expect(await setCompPaymentReceived(undefined, form({ applicationId: applications[0].id, received: "0" }))).toMatchObject({ ok: true });

  identity.user = { id: tech.id, email: tech.email };
  expect(await setJudgingOpen(undefined, form({ competitionId: competition.id, open: "1" }))).toHaveProperty("error");
  expect(await prisma.application.count({ where: { competitionId: competition.id, viewingPosition: { not: null } } })).toBe(0);

  const fingerprint = hostPaymentFingerprint(await prisma.application.findMany({
    where: { competitionId: competition.id }, select: { id: true, compPaymentReceivedAt: true },
  }));
  expect(await setJudgingOpen(undefined, form({ competitionId: competition.id, open: "1", confirmation: "HOST_PAYMENTS_REVIEWED", paymentFingerprint: fingerprint }))).toMatchObject({ ok: true });
  expect(await prisma.application.findUniqueOrThrow({ where: { id: applications[0].id } })).toMatchObject({ viewingPosition: null, compPaymentReceivedAt: null });
  expect((await prisma.application.findUniqueOrThrow({ where: { id: applications[1].id } })).viewingPosition).toBe(1);
  expect(await prisma.judgeViewingSlot.count({ where: { applicationId: applications[0].id } })).toBe(0);
});

it("keeps existing viewing slots when a historical host receipt is missing", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  await ensureCompetitionJudgeSlots(competition.id);
  const ordered = await prisma.application.findFirstOrThrow({ where: { competitionId: competition.id, viewingPosition: { not: null } } });
  const slotsBefore = await prisma.judgeViewingSlot.count({ where: { applicationId: ordered.id } });
  await prisma.application.update({ where: { id: ordered.id }, data: { compPaymentReceivedAt: null } });
  await ensureCompetitionJudgeSlots(competition.id);
  expect(await prisma.application.findUniqueOrThrow({ where: { id: ordered.id } })).toMatchObject({ viewingPosition: ordered.viewingPosition, compPaymentReceivedAt: null });
  expect(await prisma.judgeViewingSlot.count({ where: { applicationId: ordered.id } })).toBe(slotsBefore);
});

it("refuses a stale payment check if the applicant list changes", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const priorFingerprint = hostPaymentFingerprint(await prisma.application.findMany({
    where: { competitionId: competition.id }, select: { id: true, compPaymentReceivedAt: true },
  }));
  const team = await prisma.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } });
  await prisma.application.create({ data: { competitionId: competition.id, teamId: team.id } });
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  identity.user = { id: tech.id, email: tech.email };
  expect(await setJudgingOpen(undefined, form({ competitionId: competition.id, open: "1", confirmation: "HOST_PAYMENTS_REVIEWED", paymentFingerprint: priorFingerprint }))).toHaveProperty("error");
  expect(await prisma.application.count({ where: { competitionId: competition.id, viewingPosition: { not: null } } })).toBe(0);

  const currentFingerprint = hostPaymentFingerprint(await prisma.application.findMany({
    where: { competitionId: competition.id }, select: { id: true, compPaymentReceivedAt: true },
  }));
  expect(await setJudgingOpen(undefined, form({ competitionId: competition.id, open: "1", confirmation: "HOST_PAYMENTS_REVIEWED", paymentFingerprint: currentFingerprint }))).toMatchObject({ ok: true });
  expect(await prisma.application.findFirstOrThrow({ where: { competitionId: competition.id, teamId: team.id } })).toMatchObject({ viewingPosition: null });
});
