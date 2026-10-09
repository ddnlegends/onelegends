import { afterAll, beforeEach, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => session.userId ? { id: session.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { removeCompetitionApplication } from "@/app/actions/ops-applications";
import { setJudgingOpen } from "@/app/actions/ops-judging";
import { ensureCompetitionJudgeSlots } from "@/lib/judging";
import { prisma } from "@/lib/prisma";
import { E2E, seedE2E } from "../prisma/e2e-seed";

let competitionId: string;
let applicationId: string;

function removalForm(compId = competitionId, appId = applicationId) {
  const form = new FormData();
  form.set("competitionId", compId);
  form.set("applicationId", appId);
  return form;
}

beforeEach(async () => {
  await seedE2E();
  session.userId = (await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.tech }, select: { id: true },
  })).id;
  const app = await prisma.application.findFirstOrThrow({
    where: { competition: { slug: E2E.comps.showcase.slug }, team: { name: E2E.teams.alpha.name } },
  });
  competitionId = app.competitionId;
  applicationId = app.id;
});
afterAll(async () => { await prisma.$disconnect(); });

it("removes one unpaid application before judging and excludes it from the viewing order", async () => {
  expect(await removeCompetitionApplication(undefined, removalForm())).toMatchObject({ ok: true });
  expect(await prisma.application.findUnique({ where: { id: applicationId } })).toBeNull();
  expect(await prisma.application.count({ where: { competitionId } })).toBe(1);
  expect(await prisma.teamProfile.findFirst({ where: { name: E2E.teams.alpha.name } })).not.toBeNull();

  const open = new FormData();
  open.set("competitionId", competitionId);
  open.set("open", "1");
  expect(await setJudgingOpen(undefined, open)).toMatchObject({ ok: true });
  expect(await prisma.judgeViewingSlot.count({ where: { assignment: { competitionId } } })).toBe(1);
});

it("requires tech admin access and a matching competition", async () => {
  session.userId = (await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.comp }, select: { id: true },
  })).id;
  expect(await removeCompetitionApplication(undefined, removalForm())).toHaveProperty("error");
  session.userId = (await prisma.user.findUniqueOrThrow({
    where: { email: E2E.emails.tech }, select: { id: true },
  })).id;
  const other = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.closed.slug } });
  expect(await removeCompetitionApplication(undefined, removalForm(other.id))).toHaveProperty("error");
  expect(await prisma.application.findUnique({ where: { id: applicationId } })).not.toBeNull();
});

it("does not open judging when every application was removed", async () => {
  const second = await prisma.application.findFirstOrThrow({
    where: { competitionId, id: { not: applicationId } }, select: { id: true },
  });
  expect(await removeCompetitionApplication(undefined, removalForm())).toMatchObject({ ok: true });
  expect(await removeCompetitionApplication(undefined, removalForm(competitionId, second.id))).toMatchObject({ ok: true });
  const open = new FormData();
  open.set("competitionId", competitionId);
  open.set("open", "1");
  expect(await setJudgingOpen(undefined, open)).toMatchObject({ error: "No applications to judge yet." });
  expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).judgingOpen).toBe(false);
});

it("refuses removal while applications are open or after a judging order exists", async () => {
  await prisma.competitionProfile.update({
    where: { id: competitionId },
    data: { acceptingApps: true, applicationDeadline: new Date(Date.now() + 86_400_000) },
  });
  expect(await removeCompetitionApplication(undefined, removalForm())).toMatchObject({
    error: "Close applications before removing unpaid teams.",
  });
  await prisma.competitionProfile.update({
    where: { id: competitionId }, data: { acceptingApps: false },
  });
  await ensureCompetitionJudgeSlots(competitionId);
  expect(await removeCompetitionApplication(undefined, removalForm())).toMatchObject({
    error: "Applications cannot be removed after the judging order is created.",
  });
  expect(await prisma.application.count({ where: { competitionId } })).toBe(2);
  expect(await prisma.judgeViewingSlot.count({ where: { assignment: { competitionId } } })).toBe(2);
});
