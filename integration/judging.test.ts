import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/app/actions/auth", () => ({ requireUser: async () => session.userId ? { id: session.userId } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { seedE2E, E2E } from "../prisma/e2e-seed";
import { prisma } from "@/lib/prisma";
import { ensureCompetitionJudgeSlots } from "@/lib/judging";
import { saveTeamScores, submitJudgingPacket } from "@/app/actions/judge";
import { setLiveTeam } from "@/app/actions/moderator";
import { finalizeCompetitionResults, releaseCompetitionResults, removeJudgeAssignment } from "@/app/actions/comp-judging";
import { setJudgingOpen } from "@/app/actions/ops-judging";
import { grantModeratorAccess, removeModeratorAccess } from "@/app/actions/ops-admin";
import { setCompetitionPartnerStatus } from "@/app/actions/team-access";
import { hasModeratorAccess } from "@/lib/moderator";

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

function closeForm() {
  const data = new FormData();
  data.set("competitionId", competitionId);
  data.set("open", "0");
  return data;
}

describe("judging with real PostgreSQL transactions", () => {
  it.each([
    ["Partner", true, false],
    ["Affiliate", false, true],
  ])("keeps a registered moderator through live %s viewing", async (_label, isPartner, isAffiliate) => {
    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { isPartner, isAffiliate } });
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    const original = await prisma.moderatorAccess.findFirstOrThrow({ where: { competitionId } });
    const remove = new FormData(); remove.set("accessId", original.id);
    expect(await removeModeratorAccess(undefined, remove)).toHaveProperty("error");
    expect(await prisma.moderatorAccess.findUnique({ where: { id: original.id } })).not.toBeNull();

    const invite = new FormData(); invite.set("competitionId", competitionId); invite.set("email", "new-moderator@example.com");
    expect(await grantModeratorAccess(undefined, invite)).toHaveProperty("error");
    expect(await prisma.moderatorAccess.findUnique({ where: { id: original.id } })).not.toBeNull();
    expect(await prisma.moderatorInvite.count({ where: { competitionId } })).toBe(0);

    const replacement = new FormData(); replacement.set("competitionId", competitionId); replacement.set("email", E2E.emails.team);
    expect(await grantModeratorAccess(undefined, replacement)).toMatchObject({ ok: true });
    const newAccess = await prisma.moderatorAccess.findFirstOrThrow({ where: { competitionId } });
    expect(newAccess.userId).toBe((await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } })).id);
    expect(await prisma.moderatorAccess.count({ where: { competitionId } })).toBe(1);
    const removeNew = new FormData(); removeNew.set("accessId", newAccess.id);
    expect(await removeModeratorAccess(undefined, removeNew)).toHaveProperty("error");

    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { judgingOpen: false } });
    const removeReplacement = new FormData(); removeReplacement.set("accessId", newAccess.id);
    expect(await removeModeratorAccess(undefined, removeReplacement)).toMatchObject({ ok: true });
    expect(await prisma.moderatorAccess.count({ where: { competitionId } })).toBe(0);
  });
  it("does not switch a live Non-partner competition into assigned-moderator viewing", async () => {
    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { isPartner: false } });
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    const access = await prisma.moderatorAccess.findFirstOrThrow({ where: { competitionId } });
    const remove = new FormData(); remove.set("accessId", access.id);
    expect(await removeModeratorAccess(undefined, remove)).toMatchObject({ ok: true });
    const change = new FormData(); change.set("competitionId", competitionId); change.set("type", "partner");
    expect(await setCompetitionPartnerStatus(undefined, change)).toHaveProperty("error");
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).isPartner).toBe(false);
  });
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
  it("keeps judging open until every team is saved and the packet is submitted", async () => {
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    expect(await setJudgingOpen(undefined, closeForm())).toHaveProperty("error");
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).judgingOpen).toBe(true);

    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.judge } })).id;
    await completePacket();
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    expect(await setJudgingOpen(undefined, closeForm())).toHaveProperty("error");

    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.judge } })).id;
    expect(await submitJudgingPacket(undefined, form())).toMatchObject({ ok: true });
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    expect(await setJudgingOpen(undefined, closeForm())).toMatchObject({ ok: true });
    const closed = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } });
    expect(closed.judgingOpen).toBe(false);
    expect(closed.livePosition).toBeNull();
  });
  it("can close after a tech admin removes an unavailable judge during viewing", async () => {
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
    const second = await prisma.judgeProfile.create({
      data: { userId: otherUser.id, name: "Second judge", assignments: { create: { competitionId, status: "APPROVED" } } },
      include: { assignments: true },
    });
    await ensureCompetitionJudgeSlots(competitionId);
    await completePacket();
    expect(await submitJudgingPacket(undefined, form())).toMatchObject({ ok: true });

    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    expect(await setJudgingOpen(undefined, closeForm())).toHaveProperty("error");
    const removal = new FormData();
    removal.set("assignmentId", second.assignments[0].id);
    removal.set("confirmation", "REMOVE");
    removal.set("reason", "Unavailable during viewing");
    expect(await removeJudgeAssignment(undefined, removal)).toMatchObject({ ok: true });
    expect(await setJudgingOpen(undefined, closeForm())).toMatchObject({ ok: true });
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
  it("Partner submissions require separate validation and release", async () => {
    await completePacket();
    const results = await Promise.all([submitJudgingPacket(undefined, form()), submitJudgingPacket(undefined, form())]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).resultsReleasedAt).toBeNull();
    const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
    session.userId = tech.id;
    const confirm = new FormData();
    confirm.set("competitionId", competitionId);
    confirm.set("confirmation", "FINALIZE");
    expect(await finalizeCompetitionResults(undefined, confirm)).toMatchObject({ ok: true });
    const validated = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } });
    expect(validated.resultsFinalizedByEmail).toBe(E2E.emails.tech);
    expect(validated.resultsReleasedAt).toBeNull();
    const release = new FormData(); release.set("competitionId", competitionId); release.set("confirmation", "RELEASE");
    expect(await releaseCompetitionResults(undefined, release)).toMatchObject({ ok: true });
    const released = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } });
    expect(released.resultsReleasedAt).not.toBeNull();
    expect(released.judgingOpen).toBe(false);
    const before = await prisma.judgeScore.findMany({ orderBy: { id: "asc" } });
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.judge } })).id;
    expect(await saveTeamScores(undefined, form())).toHaveProperty("error");
    expect(await prisma.judgeScore.findMany({ orderBy: { id: "asc" } })).toEqual(before);
  });
  it("Affiliate submissions also require tech validation and release", async () => {
    await prisma.competitionProfile.update({
      where: { id: competitionId },
      data: { isPartner: false, isAffiliate: true },
    });
    const host = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } });
    const moderator = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.moderator } });
    expect(await hasModeratorAccess(host.id, competitionId)).toBe(false);
    expect(await hasModeratorAccess(moderator.id, competitionId)).toBe(true);
    await completePacket();
    expect(await submitJudgingPacket(undefined, form())).toMatchObject({ ok: true });
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).resultsReleasedAt).toBeNull();

    const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
    session.userId = tech.id;
    const confirm = new FormData();
    confirm.set("competitionId", competitionId);
    confirm.set("confirmation", "FINALIZE");
    expect(await finalizeCompetitionResults(undefined, confirm)).toMatchObject({ ok: true });
    const validated = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } });
    expect(validated.resultsFinalizedByEmail).toBe(E2E.emails.tech);
    expect(validated.resultsReleasedAt).toBeNull();

    const release = new FormData();
    release.set("competitionId", competitionId);
    release.set("confirmation", "RELEASE");
    expect(await releaseCompetitionResults(undefined, release)).toMatchObject({ ok: true });
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).resultsReleasedAt).not.toBeNull();
  });
  it("Non Partner results release automatically after the final packet", async () => {
    await prisma.competitionProfile.update({ where: { id: competitionId }, data: { isPartner: false } });
    await completePacket();
    expect(await submitJudgingPacket(undefined, form())).toMatchObject({ ok: true });
    const competition = await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } });
    expect(competition.resultsReleasedAt).not.toBeNull();
    expect(competition.resultsFinalizedByEmail).toBeNull();
    const tech = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
    session.userId = tech.id;
    const confirm = new FormData(); confirm.set("competitionId", competitionId); confirm.set("confirmation", "FINALIZE");
    expect(await finalizeCompetitionResults(undefined, confirm)).toHaveProperty("error");
  });
  it("waits for every active judge even when the legacy threshold is one", async () => {
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
    await prisma.judgeProfile.create({ data: { userId: otherUser.id, name: "Second judge", assignments: { create: { competitionId, status: "APPROVED" } } } });
    await completePacket();
    expect(await submitJudgingPacket(undefined, form())).toMatchObject({ ok: true });
    expect((await prisma.competitionProfile.findUniqueOrThrow({ where: { id: competitionId } })).resultsReleasedAt).toBeNull();
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } })).id;
    const confirm = new FormData(); confirm.set("competitionId", competitionId); confirm.set("confirmation", "FINALIZE");
    expect(await finalizeCompetitionResults(undefined, confirm)).toHaveProperty("error");
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    const second = await prisma.judgeAssignment.findFirstOrThrow({ where: { competitionId, judge: { userId: otherUser.id } } });
    const removal = new FormData(); removal.set("assignmentId", second.id); removal.set("confirmation", "REMOVE"); removal.set("reason", "Unavailable during viewing");
    expect(await removeJudgeAssignment(undefined, removal)).toMatchObject({ ok: true });
    expect((await prisma.judgeAssignment.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("REMOVED");
    session.userId = (await prisma.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } })).id;
    expect(await finalizeCompetitionResults(undefined, confirm)).toMatchObject({ ok: true });
  });
  it("the database rejects accepting applications while judging is open", async () => {
    await expect(prisma.competitionProfile.update({ where: { id: competitionId }, data: { acceptingApps: true } })).rejects.toThrow();
  });
});
