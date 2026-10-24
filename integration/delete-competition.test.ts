import { afterAll, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => identity.userId ? { id: identity.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { E2E, seedE2E } from "../prisma/e2e-seed";
import { deleteCompetition } from "@/app/actions/team-access";
import { ensureCompetitionJudgeSlots } from "@/lib/judging";
import { prisma } from "@/lib/prisma";

beforeEach(async () => { await seedE2E(); identity.userId = ""; });
afterAll(async () => { await prisma.$disconnect(); });

function deletion(competitionId: string, name: string) {
  const data = new FormData();
  data.set("competitionId", competitionId);
  data.set("competitionName", name);
  data.set("confirmation", "DELETE");
  data.set("reason", "Duplicate listing");
  return data;
}

it("requires tech admin and exact confirmation, then cascades history and leaves an audit record", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const host = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  identity.userId = host.id;
  expect(await deleteCompetition(undefined, deletion(competition.id, competition.name))).toHaveProperty("error");
  identity.userId = tech.id;
  expect(await deleteCompetition(undefined, deletion(competition.id, "Wrong name"))).toHaveProperty("error");
  await ensureCompetitionJudgeSlots(competition.id);
  const slot = await prisma.judgeViewingSlot.findFirstOrThrow({ where: { assignment: { competitionId: competition.id } } });
  await prisma.judgeScore.create({ data: { slotId: slot.id, assignmentId: slot.assignmentId, choreography: 8, formations: 8, technique: 8, syncCleanliness: 8, overallImpression: 8 } });
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { judgingOpen: true } });
  expect(await deleteCompetition(undefined, deletion(competition.id, competition.name))).toHaveProperty("error");
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { judgingOpen: false, resultsReleasedAt: new Date() } });
  expect(await deleteCompetition(undefined, deletion(competition.id, competition.name))).toMatchObject({ ok: true });
  expect(await prisma.competitionProfile.findUnique({ where: { id: competition.id } })).toBeNull();
  expect(await prisma.application.count({ where: { competitionId: competition.id } })).toBe(0);
  expect(await prisma.judgeScore.count({ where: { assignment: { competitionId: competition.id } } })).toBe(0);
  expect(await prisma.competitionDeletionAudit.findFirst({ where: { competitionId: competition.id } })).toMatchObject({
    actorEmail: tech.email,
    applicationCount: 2,
    judgeCount: 1,
    hadReleasedResults: true,
  });
});
