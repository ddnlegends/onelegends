import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => session.userId ? { id: session.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/sheets", () => ({ syncCompetitionSheet: vi.fn().mockResolvedValue(undefined) }));

import { seedE2E, E2E } from "../prisma/e2e-seed";
import { prisma } from "@/lib/prisma";
import { ensureCompetitionJudgeSlots } from "@/lib/judging";
import { saveTeamScores, submitJudgingPacket } from "@/app/actions/judge";
import { setLiveTeam } from "@/app/actions/moderator";
import { maybeReleaseResults } from "@/lib/release";
import { syncCompetitionSheet } from "@/lib/sheets";

let competitionId: string;
let assignmentId: string;
function form(position = 1, forAssignment = assignmentId) {
  const data = new FormData();
  data.set("assignmentId", forAssignment);
  data.set("position", String(position));
  for (const key of ["choreography", "formations", "technique", "syncCleanliness", "overallImpression"]) data.set(key, "8");
  return data;
}

beforeEach(async () => {
  await seedE2E();
  vi.clearAllMocks();
  const judge = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.judge } });
  session.userId = judge.id;
  const assignment = await prisma.judgeAssignment.findFirstOrThrow({ where: { judge: { userId: judge.id } } });
  assignmentId = assignment.id;
  competitionId = assignment.competitionId;
  await ensureCompetitionJudgeSlots(competitionId);
  await prisma.competitionProfile.update({ where: { id: competitionId }, data: { judgingOpen: true, livePosition: 1 } });
});
afterAll(async () => { await prisma.$disconnect(); });

async function completePacket() {
  expect(await saveTeamScores(undefined, form(1))).toMatchObject({ ok: true });
  await prisma.competitionProfile.update({ where: { id: competitionId }, data: { livePosition: 2 } });
  expect(await saveTeamScores(undefined, form(2))).toMatchObject({ ok: true });
}

function liveForm(position: number | null) {
  const data = new FormData();
  data.set("competitionId", competitionId);
  data.set("position", position == null ? "" : String(position));
  return data;
}

describe("judging with real PostgreSQL transactions", () => {
  it("blocks future scores, allows earlier score edits, and preserves late comments", async () => {
    expect(await saveTeamScores(undefined, form(2))).toHaveProperty("error");
    expect(await prisma.judgeScore.count()).toBe(0);
    expect(await saveTeamScores(undefined, form(1))).toMatchObject({ ok: true });
    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { livePosition: 2 } });
    const edited = form(1);
    edited.set("choreography", "9");
    expect(await saveTeamScores(undefined, edited)).toMatchObject({ ok: true });
    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { livePosition: null } });
    expect(await saveTeamScores(undefined, edited)).toHaveProperty("error");
    const comment = form(1);
    comment.set("mode", "comment");
    comment.set("comment", "Audio briefly cut out");
    expect(await saveTeamScores(undefined, comment)).toMatchObject({ ok: true });
    const score = await prisma.judgeScore.findFirstOrThrow({ where: { assignmentId } });
    expect(score.choreography).toBe(9);
    expect(score.comment).toBe("Audio briefly cut out");
  });

  it("requires every approved judge to finish earlier teams before the moderator advances", async () => {
    const moderator = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.moderator } });
    const secondUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
    const second = await prisma.judgeProfile.create({
      data: {
        userId: secondUser.id,
        name: "Second judge",
        assignments: { create: { competitionId, status: "APPROVED" } },
      },
      include: { assignments: true },
    });
    await ensureCompetitionJudgeSlots(competitionId);
    session.userId = moderator.id;
    expect(await setLiveTeam(undefined, liveForm(2))).toHaveProperty("error");
    session.userId = (await prisma.judgeAssignment.findUniqueOrThrow({
      where: { id: assignmentId }, include: { judge: true },
    })).judge.userId;
    expect(await saveTeamScores(undefined, form(1))).toMatchObject({ ok: true });
    session.userId = moderator.id;
    expect(await setLiveTeam(undefined, liveForm(2))).toHaveProperty("error");
    expect(await setLiveTeam(undefined, liveForm(null))).toMatchObject({ ok: true });
    expect(await setLiveTeam(undefined, liveForm(2))).toHaveProperty("error");
    session.userId = secondUser.id;
    expect(await saveTeamScores(undefined, form(1, second.assignments[0].id))).toHaveProperty("error");
    session.userId = moderator.id;
    expect(await setLiveTeam(undefined, liveForm(1))).toMatchObject({ ok: true });
    session.userId = secondUser.id;
    expect(await saveTeamScores(undefined, form(1, second.assignments[0].id))).toMatchObject({ ok: true });
    session.userId = moderator.id;
    expect(await setLiveTeam(undefined, liveForm(2))).toMatchObject({ ok: true });
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).livePosition).toBe(2);
  });
  it("refuses another user's assignment without changing scores", async () => {
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } })).id;
    expect(await saveTeamScores(undefined, form())).toHaveProperty("error");
    expect(await submitJudgingPacket(undefined, form())).toHaveProperty("error");
    expect(await prisma.judgeScore.count()).toBe(0);
  });
  it("refuses incomplete packets and invalid scores", async () => {
    const invalid = form(); invalid.set("technique", "11");
    expect(await saveTeamScores(undefined, invalid)).toHaveProperty("error");
    await saveTeamScores(undefined, form());
    expect(await submitJudgingPacket(undefined, form())).toHaveProperty("error");
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).resultsReleasedAt).toBeNull();
  });
  it("refuses saving and submitting after ops closes judging", async () => {
    await completePacket();
    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { judgingOpen: false } });
    expect(await saveTeamScores(undefined, form())).toHaveProperty("error");
    expect(await submitJudgingPacket(undefined, form())).toHaveProperty("error");
    expect((await prisma.judgeAssignment.findUniqueOrThrow({ where: { id: assignmentId } })).submittedAt).toBeNull();
  });
  it("rechecks closure after waiting for the competition lock", async () => {
    await completePacket();
    let unlock!: () => void;
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const mayClose = new Promise<void>((resolve) => { unlock = resolve; });
    const close = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
      locked();
      await mayClose;
      await tx.competitionProfile.update({ where: { id: competitionId }, data: { judgingOpen: false } });
    });
    await lockAcquired;
    // Observe the action's actual lock request; no timing sleeps or fake DB results.
    const original = prisma.$transaction.bind(prisma);
    const entered = vi.spyOn(prisma, "$transaction").mockImplementationOnce((...args: Parameters<typeof prisma.$transaction>) => {
      unlock();
      return original(...args);
    });
    try {
      expect(await submitJudgingPacket(undefined, form())).toHaveProperty("error");
      await close;
      expect((await prisma.judgeAssignment.findUniqueOrThrow({ where: { id: assignmentId } })).submittedAt).toBeNull();
    } finally {
      unlock();
      entered.mockRestore();
      await close;
    }
  });
  it("concurrent duplicate submissions release once and seal scores", async () => {
    await completePacket();
    const results = await Promise.all([submitJudgingPacket(undefined, form()), submitJudgingPacket(undefined, form())]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    const released = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } });
    expect(released.resultsReleasedAt).not.toBeNull();
    expect(released.judgingOpen).toBe(false);
    expect(syncCompetitionSheet).toHaveBeenCalledTimes(1);
    const before = await prisma.judgeScore.findMany({ orderBy: { id: "asc" } });
    expect(await saveTeamScores(undefined, form())).toHaveProperty("error");
    expect(await prisma.judgeScore.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  });
  it("waits for the configured number of approved submitted judges", async () => {
    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { requiredJudgeCount: 2 } });
    await completePacket();
    expect(await submitJudgingPacket(undefined, form())).toMatchObject({ ok: true });
    expect(await maybeReleaseResults(competitionId)).toBe(false);
    expect(syncCompetitionSheet).not.toHaveBeenCalled();
  });
  it("the database rejects accepting applications while judging is open", async () => {
    await expect(prisma.competitionProfile.update({ where: { id: competitionId }, data: { acceptingApps: true } })).rejects.toThrow();
  });
});
