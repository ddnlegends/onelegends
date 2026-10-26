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

function deletion(competitionId: string, name: string, claimCode: string) {
  const data = new FormData();
  data.set("competitionId", competitionId);
  data.set("competitionName", name);
  data.set("claimCode", claimCode);
  data.set("confirmation", "DELETE");
  data.set("reason", "Duplicate listing");
  return data;
}

it("limits deletion to tech admins, verifies the exact comp, and preserves team data", async () => {
  const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const duplicate = await prisma.competitionProfile.create({ data: {
    slug: "same-name-duplicate", claimCode: "COMP-OTHER", name: competition.name,
  } });
  const host = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
  const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
  const teamIds = (await prisma.application.findMany({ where: { competitionId: competition.id }, select: { teamId: true } })).map((row) => row.teamId);

  identity.userId = host.id;
  expect(await deleteCompetition(undefined, deletion(competition.id, competition.name, competition.claimCode))).toHaveProperty("error");
  identity.userId = tech.id;
  expect(await deleteCompetition(undefined, deletion(competition.id, "Wrong name", competition.claimCode))).toHaveProperty("error");
  expect(await deleteCompetition(undefined, deletion(competition.id, competition.name, duplicate.claimCode))).toHaveProperty("error");

  await ensureCompetitionJudgeSlots(competition.id);
  const slot = await prisma.judgeViewingSlot.findFirstOrThrow({ where: { assignment: { competitionId: competition.id } } });
  await prisma.judgeScore.create({ data: { slotId: slot.id, assignmentId: slot.assignmentId, choreography: 8 } });
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { judgingOpen: true } });
  expect(await deleteCompetition(undefined, deletion(competition.id, competition.name, competition.claimCode))).toHaveProperty("error");
  await prisma.competitionProfile.update({ where: { id: competition.id }, data: { judgingOpen: false } });

  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  expect(await deleteCompetition(undefined, deletion(competition.id, competition.name, competition.claimCode))).toMatchObject({ ok: true });
  expect(log).toHaveBeenCalledWith("Competition deleted", expect.objectContaining({
    competitionId: competition.id,
    actorEmail: tech.email,
    reason: "Duplicate listing",
  }));
  expect(await prisma.competitionProfile.findUnique({ where: { id: competition.id } })).toBeNull();
  expect(await prisma.application.count({ where: { competitionId: competition.id } })).toBe(0);
  expect(await prisma.judgeScore.count({ where: { assignment: { competitionId: competition.id } } })).toBe(0);
  expect(await prisma.competitionProfile.findUnique({ where: { id: duplicate.id } })).not.toBeNull();
  expect(await prisma.teamProfile.count({ where: { id: { in: teamIds } } })).toBe(teamIds.length);
  log.mockRestore();
});
