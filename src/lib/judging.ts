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
  resultsReleasedAt?: Date | null;
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
  comp: {
    acceptingApps: boolean;
    applicationDeadline: Date | null;
    resultsReleasedAt?: Date | null;
  },
  now = new Date(),
): boolean {
  if (comp.resultsReleasedAt) return false;
  if (!comp.acceptingApps) return false;
  if (comp.applicationDeadline && now > comp.applicationDeadline) return false;
  return true;
}

export function isJudgingOpen(comp: CompetitionGate, now = new Date()): boolean {
  return (
    Boolean(comp.judgingOpen) &&
    !comp.resultsReleasedAt &&
    isCompetitionClaimed(comp) &&
    !isCompetitionOpen(comp, now)
  );
}

export function judgingLockMessage(
  comp: CompetitionGate,
  now = new Date(),
): string | null {
  if (comp.resultsReleasedAt) {
    return "Results are released. Scores are locked.";
  }
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

export type CompStatus =
  | "UNCLAIMED"
  | "APPS_OPEN"
  | "APPS_CLOSED"
  | "READY"
  | "LIVE"
  | "COMPLETE";

export const COMP_STATUS_LABEL: Record<CompStatus, string> = {
  UNCLAIMED: "Unclaimed",
  APPS_OPEN: "Applications open",
  APPS_CLOSED: "Applications closed",
  READY: "Ready to view",
  LIVE: "Live viewing",
  COMPLETE: "Judging complete",
};

export function competitionStatus(
  comp: CompetitionGate & {
    livePosition: number | null;
    resultsReleasedAt: Date | null;
  },
  now = new Date(),
): CompStatus {
  if (!isCompetitionClaimed(comp)) return "UNCLAIMED";
  if (comp.resultsReleasedAt) return "COMPLETE";
  if (isCompetitionOpen(comp, now)) return "APPS_OPEN";
  if (isJudgingOpen(comp, now)) {
    return comp.livePosition != null ? "LIVE" : "READY";
  }
  return "APPS_CLOSED";
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
    data: {
      resultsReleasedAt: new Date(),
      judgingOpen: false,
      livePosition: null,
      liveUpdatedAt: null,
    },
  });
  return true;
}

type OrderRow = { id: string; viewingPosition: number | null };
type SlotRow = { id: string; applicationId: string; position: number };

function slotsMatchOrder(slots: SlotRow[], order: OrderRow[]): boolean {
  if (order.some((app) => app.viewingPosition == null)) return false;
  if (slots.length !== order.length) return false;
  const want = new Map(order.map((app) => [app.id, app.viewingPosition]));
  return slots.every((slot) => want.get(slot.applicationId) === slot.position);
}

export function viewingNeighbors(positions: number[], position: number) {
  const sorted = [...positions].sort((a, b) => a - b);
  const index = sorted.indexOf(position);
  return {
    index,
    prev: index > 0 ? sorted[index - 1] : null,
    next: index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}

/**
 * One shuffled team order per competition. Every judge's slots copy it, so
 * "Team 3" is the same team for every judge and for REG.
 */
export async function ensureSharedViewingOrder(
  competitionId: string,
  onlyAssignmentId?: string,
) {
  const [order, assignments] = await Promise.all([
    prisma.application.findMany({
      where: { competitionId },
      select: { id: true, viewingPosition: true },
    }),
    prisma.judgeAssignment.findMany({
      where: {
        competitionId,
        status: "APPROVED",
        ...(onlyAssignmentId ? { id: onlyAssignmentId } : {}),
      },
      select: {
        id: true,
        slots: { select: { id: true, applicationId: true, position: true } },
      },
    }),
  ]);
  if (order.length === 0) return;
  const orderReady = order.every((app) => app.viewingPosition != null);
  if (
    orderReady &&
    assignments.every((row) => slotsMatchOrder(row.slots, order))
  ) {
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Serializes concurrent page loads that would otherwise race on positions.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${competitionId}))`;

      const apps = await tx.application.findMany({
        where: { competitionId },
        select: { id: true, viewingPosition: true },
      });
      const missing = apps.filter((app) => app.viewingPosition == null);
      if (missing.length) {
        let next = apps.reduce(
          (max, app) => Math.max(max, app.viewingPosition ?? 0),
          0,
        );
        for (const app of shuffleCopy(missing)) {
          next += 1;
          await tx.application.update({
            where: { id: app.id },
            data: { viewingPosition: next },
          });
          app.viewingPosition = next;
        }
      }
      const want = new Map(apps.map((app) => [app.id, app.viewingPosition as number]));

      const rows = await tx.judgeAssignment.findMany({
        where: {
          competitionId,
          status: "APPROVED",
          ...(onlyAssignmentId ? { id: onlyAssignmentId } : {}),
        },
        select: {
          id: true,
          slots: { select: { id: true, applicationId: true, position: true } },
        },
      });
      for (const row of rows) {
        const wrong = row.slots.filter(
          (slot) => want.get(slot.applicationId) !== slot.position,
        );
        // Park mismatched slots on negative positions first so the
        // (assignmentId, position) unique index never collides mid-swap.
        for (const [index, slot] of wrong.entries()) {
          await tx.judgeViewingSlot.update({
            where: { id: slot.id },
            data: { position: -(index + 1) },
          });
        }
        for (const slot of wrong) {
          const position = want.get(slot.applicationId);
          if (position == null) continue;
          await tx.judgeViewingSlot.update({
            where: { id: slot.id },
            data: { position },
          });
        }
        const have = new Set(row.slots.map((slot) => slot.applicationId));
        const toCreate = apps.filter((app) => !have.has(app.id));
        if (toCreate.length) {
          await tx.judgeViewingSlot.createMany({
            data: toCreate.map((app) => ({
              assignmentId: row.id,
              applicationId: app.id,
              position: app.viewingPosition as number,
            })),
            skipDuplicates: true,
          });
        }
      }
    },
    { maxWait: 15000, timeout: 30000 },
  );
}

export async function ensureViewingSlots(assignmentId: string) {
  const assignment = await prisma.judgeAssignment.findUnique({
    where: { id: assignmentId },
    select: { competitionId: true, status: true },
  });
  if (!assignment || assignment.status !== "APPROVED") return;
  await ensureSharedViewingOrder(assignment.competitionId, assignmentId);
}

export async function ensureCompetitionJudgeSlots(competitionId: string) {
  await ensureSharedViewingOrder(competitionId);
}
