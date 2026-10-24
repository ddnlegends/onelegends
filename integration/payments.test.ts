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
  verifyCompPayments,
} from "@/app/actions/payments";
import { ensureCompetitionJudgeSlots } from "@/lib/judging";
import { setJudgingOpen } from "@/app/actions/ops-judging";
import { viewingEligibleApplicationWhere } from "@/lib/payment-eligibility";
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

it("lets only the host record payment after a final Accepted decision", async () => {
  const application = await prisma.application.findFirstOrThrow({
    where: { competition: { slug: E2E.comps.showcase.slug } },
    select: { id: true, competitionId: true },
  });
  await prisma.$transaction([
    prisma.application.update({
      where: { id: application.id },
      data: { status: "ACCEPTED" },
    }),
    prisma.competitionProfile.update({
      where: { id: application.competitionId },
      data: { resultsReleasedAt: new Date(), decisionsSubmittedAt: new Date() },
    }),
  ]);

  const outsider = await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.team },
  });
  identity.user = { id: outsider.id, email: outsider.email };
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
    compPaymentRecordedByEmail: host.email,
  });
});

it("requires host review and explicit preflight before viewing, excluding host-unpaid teams", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const apps = await prisma.application.findMany({ where: { competitionId: competition.id }, orderBy: { team: { name: "asc" } } });
  await prisma.application.update({ where: { id: apps[0].id }, data: { compPaymentReviewStatus: "UNREVIEWED", compPaymentReceivedAt: null } });
  await prisma.application.update({ where: { id: apps[1].id }, data: { compPaymentReviewStatus: "UNPAID", compPaymentReceivedAt: null } });
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { compPaymentsVerifiedAt: null } });

  const host = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  identity.user = { id: host.id, email: host.email };
  expect(await verifyCompPayments(undefined, form({ competitionId: competition.id, confirmation: "VERIFY" }))).toHaveProperty("error");
  expect(await setCompPaymentReceived(undefined, form({ applicationId: apps[0].id, status: "PAID" }))).toMatchObject({ ok: true });
  expect(await verifyCompPayments(undefined, form({ competitionId: competition.id, confirmation: "VERIFY" }))).toMatchObject({ ok: true });
  expect(await prisma.application.count({ where: { competitionId: competition.id, ...viewingEligibleApplicationWhere } })).toBe(1);

  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  identity.user = { id: tech.id, email: tech.email };
  expect(await setJudgingOpen(undefined, form({ competitionId: competition.id, open: "1" }))).toHaveProperty("error");
  expect(await setJudgingOpen(undefined, form({ competitionId: competition.id, open: "1", paymentConfirmation: "CONFIRM" }))).toMatchObject({ ok: true });
  expect(await prisma.application.count({ where: { competitionId: competition.id, viewingPosition: { not: null } } })).toBe(1);
});
