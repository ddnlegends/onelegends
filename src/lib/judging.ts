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
export type PartialRubricScores = Record<RubricKey, number | null>;

type CompetitionGate = {
  judgingOpen: boolean;
  acceptingApps: boolean;
  applicationDeadline: Date | null;
  claimedAt?: Date | null;
  userId?: string | null;
};

export function isCompetitionClaimed(comp: {
  claimedAt?: Date | null;
  userId?: string | null;
}): boolean {
  return Boolean(comp.claimedAt || comp.userId);
}

export function isCompetitionOpen(
  comp: { acceptingApps: boolean; applicationDeadline: Date | null },
  now = new Date(),
): boolean {
  if (!comp.acceptingApps) return false;
  if (comp.applicationDeadline && now > comp.applicationDeadline) return false;
  return true;
}

export function isJudgingOpen(comp: CompetitionGate, now = new Date()): boolean {
  return (
    Boolean(comp.judgingOpen) &&
    isCompetitionClaimed(comp) &&
    !isCompetitionOpen(comp, now)
  );
}

export function judgingLockMessage(
  comp: CompetitionGate,
  now = new Date(),
): string | null {
  if (!isCompetitionClaimed(comp)) {
    return "Judging opens after this competition is claimed.";
  }
  if (isCompetitionOpen(comp, now)) {
    return "Judging opens after applications close.";
  }
  if (!comp.judgingOpen) {
    return "Judging is closed. Circuit ops will open it when it is time to score.";
  }
  return null;
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

export function toPartialRubric(
  score:
    | {
        choreography: number | null;
        formations: number | null;
        technique: number | null;
        syncCleanliness: number | null;
        overallImpression: number | null;
      }
    | null
    | undefined,
): PartialRubricScores | null {
  if (!score) return null;
  return {
    choreography: score.choreography,
    formations: score.formations,
    technique: score.technique,
    syncCleanliness: score.syncCleanliness,
    overallImpression: score.overallImpression,
  };
}

export function isScoreComplete(
  score: PartialRubricScores | RubricScores | null | undefined,
): score is RubricScores {
  if (!score) return false;
  return RUBRIC_CATEGORIES.every((category) => {
    const value = score[category.key];
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;
  });
}

export function priorTeamsScored(
  slots: Array<{
    position: number;
    score: PartialRubricScores | RubricScores | null | undefined;
  }>,
  position: number,
): boolean {
  return slots
    .filter((slot) => slot.position < position)
    .every((slot) => isScoreComplete(slot.score));
}

export function firstIncompletePosition(
  slots: Array<{
    position: number;
    score: PartialRubricScores | RubricScores | null | undefined;
  }>,
): number | null {
  const ordered = [...slots].sort((a, b) => a.position - b.position);
  return ordered.find((slot) => !isScoreComplete(slot.score))?.position ?? null;
}

export function rubricFilledCount(
  score: PartialRubricScores | RubricScores | null | undefined,
): number {
  if (!score) return 0;
  return RUBRIC_CATEGORIES.filter((category) => {
    const value = score[category.key];
    return typeof value === "number";
  }).length;
}

export function rubricTotalOrNull(
  score: PartialRubricScores | RubricScores | null | undefined,
): number | null {
  if (!isScoreComplete(score)) return null;
  return rubricTotal(score);
}

export function rubricCell(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "—";
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

export async function ensureCompetitionJudgeSlots(competitionId: string) {
  const assignments = await prisma.judgeAssignment.findMany({
    where: { competitionId, status: "APPROVED" },
    select: { id: true },
  });
  for (const row of assignments) {
    await ensureViewingSlots(row.id);
  }
}
