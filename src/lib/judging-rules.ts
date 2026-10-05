/**
 * Pure judging rules with no database access, so client components import
 * from here: the rubric, competition lifecycle gates (`isCompetitionOpen`,
 * `isJudgingOpen`, `competitionStatus`), score helpers, and z-scores.
 * `src/lib/judging.ts` re-exports all of it alongside the server-side
 * viewing-order helpers. Keep this file free of `@/lib/prisma` and any other
 * server import, or it ends up in the browser bundle.
 */
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

export function viewingNeighbors(positions: number[], position: number) {
  const sorted = [...positions].sort((a, b) => a - b);
  const index = sorted.indexOf(position);
  return {
    index,
    prev: index > 0 ? sorted[index - 1] : null,
    next: index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}
