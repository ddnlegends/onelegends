import type { JudgingMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const RUBRIC_CATEGORIES = [
  { key: "choreography", label: "Choreography", max: 10 },
  { key: "formations", label: "Formations", max: 10 },
  { key: "technique", label: "Technique", max: 10 },
  { key: "syncCleanliness", label: "Sync & Cleanliness", max: 10 },
  { key: "overallImpression", label: "Overall Impression", max: 10 },
] as const;

export type RubricKey = (typeof RUBRIC_CATEGORIES)[number]["key"];

export type RubricScores = Record<RubricKey, number>;

export function isCompetitionOpen(
  comp: { acceptingApps: boolean; applicationDeadline: Date | null },
  now = new Date(),
): boolean {
  if (!comp.acceptingApps) return false;
  if (comp.applicationDeadline && now > comp.applicationDeadline) return false;
  return true;
}

export function rubricTotal(scores: RubricScores): number {
  return (
    scores.choreography +
    scores.formations +
    scores.technique +
    scores.syncCleanliness +
    scores.overallImpression
  );
}

export function scoreComment(
  score: { comment?: string | null } | null | undefined,
): string {
  return score?.comment?.trim() ?? "";
}

export function parseRubricScore(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10) return null;
  return n;
}

export function shuffleCopy<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function zScores(totals: number[]): number[] {
  if (totals.length === 0) return [];
  const mean = totals.reduce((sum, n) => sum + n, 0) / totals.length;
  const variance =
    totals.reduce((sum, n) => sum + (n - mean) ** 2, 0) / totals.length;
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return totals.map(() => 0);
  return totals.map((n) => (n - mean) / stdev);
}

export function toDatetimeLocalValue(date: Date | null | undefined): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function maybeReleaseResults(competitionId: string) {
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      judgeAssignments: {
        where: { status: "APPROVED", submittedAt: { not: null } },
        select: { id: true },
      },
    },
  });
  if (!competition) return false;
  if (competition.resultsReleasedAt) return true;

  const completed = competition.judgeAssignments.length;
  if (completed < competition.requiredJudgeCount) return false;

  await prisma.competitionProfile.update({
    where: { id: competitionId },
    data: { resultsReleasedAt: new Date() },
  });
  return true;
}

export async function ensureViewingSlots(assignmentId: string) {
  const assignment = await prisma.judgeAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      slots: true,
      competition: {
        include: { applications: { select: { id: true } } },
      },
    },
  });
  if (!assignment || assignment.status !== "APPROVED") {
    return assignment;
  }
  if (assignment.slots.length > 0) return assignment;

  if (assignment.competition.judgingMode === "LIVE") {
    await ensureSharedLiveSlots(assignment.competitionId);
    return prisma.judgeAssignment.findUnique({
      where: { id: assignmentId },
      include: { slots: true },
    });
  }

  const applications = assignment.competition.applications;
  if (applications.length === 0) return assignment;

  const shuffled = shuffleCopy(applications);
  await prisma.judgeViewingSlot.createMany({
    data: shuffled.map((app, index) => ({
      assignmentId,
      applicationId: app.id,
      position: index + 1,
    })),
  });

  return prisma.judgeAssignment.findUnique({
    where: { id: assignmentId },
    include: { slots: true },
  });
}

export function isLiveJudging(mode: JudgingMode): boolean {
  return mode === "LIVE";
}

export async function ensureSharedLiveSlots(competitionId: string) {
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      applications: { select: { id: true } },
      judgeAssignments: {
        where: { status: "APPROVED" },
        include: { slots: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!competition) return null;

  const applications = competition.applications;
  if (applications.length === 0) return competition;

  const appIds = new Set(applications.map((row) => row.id));
  let order = competition.liveOrder.filter((id) => appIds.has(id));
  if (order.length !== applications.length) {
    const existing = competition.judgeAssignments.find(
      (row) => row.slots.length === applications.length,
    );
    order = existing
      ? existing.slots.map((slot) => slot.applicationId)
      : shuffleCopy(applications).map((row) => row.id);
    await prisma.competitionProfile.update({
      where: { id: competitionId },
      data: { liveOrder: order },
    });
  }

  for (const assignment of competition.judgeAssignments) {
    const matches =
      assignment.slots.length === order.length &&
      assignment.slots.every(
        (slot, index) =>
          slot.position === index + 1 && slot.applicationId === order[index],
      );
    if (matches) continue;

    if (assignment.slots.length === 0) {
      await prisma.judgeViewingSlot.createMany({
        data: order.map((applicationId, index) => ({
          assignmentId: assignment.id,
          applicationId,
          position: index + 1,
        })),
      });
      continue;
    }

    await realignLiveSlots(assignment.id, order);
  }

  return prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
}

async function realignLiveSlots(assignmentId: string, order: string[]) {
  await prisma.$transaction(async (tx) => {
    const scores = await tx.judgeScore.findMany({
      where: { assignmentId },
      include: { slot: { select: { applicationId: true } } },
    });
    const scoreByApp = new Map(
      scores.map((row) => [row.slot.applicationId, row] as const),
    );

    await tx.judgeScore.deleteMany({ where: { assignmentId } });
    await tx.judgeViewingSlot.deleteMany({ where: { assignmentId } });
    await tx.judgeViewingSlot.createMany({
      data: order.map((applicationId, index) => ({
        assignmentId,
        applicationId,
        position: index + 1,
      })),
    });

    const newSlots = await tx.judgeViewingSlot.findMany({
      where: { assignmentId },
    });
    const restored = newSlots.flatMap((slot) => {
      const prev = scoreByApp.get(slot.applicationId);
      if (!prev) return [];
      return [
        {
          assignmentId,
          slotId: slot.id,
          choreography: prev.choreography,
          formations: prev.formations,
          technique: prev.technique,
          syncCleanliness: prev.syncCleanliness,
          overallImpression: prev.overallImpression,
          comment: prev.comment,
        },
      ];
    });
    if (restored.length > 0) {
      await tx.judgeScore.createMany({ data: restored });
    }
  });
}
