import { describe, expect, it } from "vitest";
import {
  competitionStatus,
  isCompetitionOpen,
  isJudgingOpen,
  isScoreComplete,
  judgingLockMessage,
  parseRubricScore,
  rubricFilledCount,
  rubricTotal,
  rubricTotalOrNull,
  shuffleCopy,
  viewingNeighbors,
  zScores,
} from "@/lib/judging";

const NOW = new Date("2026-10-05T12:00:00Z");
const PAST = new Date("2026-10-01T12:00:00Z");
const FUTURE = new Date("2026-10-10T12:00:00Z");

const claimedClosed = {
  acceptingApps: false,
  judgingOpen: false,
  applicationDeadline: PAST,
  resultsReleasedAt: null,
  claimedAt: PAST,
  userId: "owner",
  livePosition: null,
};

const full = {
  choreography: 8,
  formations: 7,
  technique: 9,
  syncCleanliness: 6,
  overallImpression: 10,
};

describe("isCompetitionOpen", () => {
  it("is open only while accepting, before the deadline, and before release", () => {
    expect(
      isCompetitionOpen(
        { ...claimedClosed, acceptingApps: true, earlyApplicationDeadline: PAST, applicationDeadline: FUTURE },
        NOW,
      ),
    ).toBe(true);
    expect(
      isCompetitionOpen({ ...claimedClosed, acceptingApps: true, applicationDeadline: FUTURE }, NOW),
    ).toBe(true);
    expect(isCompetitionOpen({ ...claimedClosed, acceptingApps: true }, NOW)).toBe(false);
    expect(
      isCompetitionOpen({ ...claimedClosed, acceptingApps: true, applicationDeadline: null }, NOW),
    ).toBe(true);
    expect(
      isCompetitionOpen(
        { ...claimedClosed, acceptingApps: true, applicationDeadline: null, resultsReleasedAt: PAST },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("isJudgingOpen", () => {
  it("requires the flag, a claim, closed applications, and no release", () => {
    expect(isJudgingOpen({ ...claimedClosed, judgingOpen: true }, NOW)).toBe(true);
    expect(isJudgingOpen(claimedClosed, NOW)).toBe(false);
    expect(
      isJudgingOpen({ ...claimedClosed, judgingOpen: true, claimedAt: null, userId: null }, NOW),
    ).toBe(false);
    expect(
      isJudgingOpen(
        { ...claimedClosed, judgingOpen: true, acceptingApps: true, applicationDeadline: FUTURE },
        NOW,
      ),
    ).toBe(false);
    expect(
      isJudgingOpen({ ...claimedClosed, judgingOpen: true, resultsReleasedAt: PAST }, NOW),
    ).toBe(false);
  });
});

describe("judgingLockMessage", () => {
  it("explains each reason judging is locked, and is null when open", () => {
    expect(judgingLockMessage({ ...claimedClosed, resultsReleasedAt: PAST }, NOW)).toMatch(/released/);
    expect(judgingLockMessage({ ...claimedClosed, claimedAt: null, userId: null }, NOW)).toMatch(
      /claimed/,
    );
    expect(
      judgingLockMessage({ ...claimedClosed, acceptingApps: true, applicationDeadline: FUTURE }, NOW),
    ).toMatch(/applications close/);
    expect(judgingLockMessage(claimedClosed, NOW)).toMatch(/closed/);
    expect(judgingLockMessage({ ...claimedClosed, judgingOpen: true }, NOW)).toBeNull();
  });
});

describe("competitionStatus", () => {
  it("walks through the lifecycle", () => {
    expect(competitionStatus({ ...claimedClosed, claimedAt: null, userId: null }, NOW)).toBe(
      "UNCLAIMED",
    );
    expect(
      competitionStatus({ ...claimedClosed, acceptingApps: true, applicationDeadline: FUTURE }, NOW),
    ).toBe("APPS_OPEN");
    expect(competitionStatus(claimedClosed, NOW)).toBe("APPS_CLOSED");
    expect(competitionStatus({ ...claimedClosed, judgingOpen: true }, NOW)).toBe("READY");
    expect(competitionStatus({ ...claimedClosed, judgingOpen: true, livePosition: 2 }, NOW)).toBe(
      "LIVE",
    );
    expect(competitionStatus({ ...claimedClosed, resultsReleasedAt: PAST }, NOW)).toBe("COMPLETE");
  });
});

describe("rubric helpers", () => {
  it("totals a complete rubric", () => {
    expect(rubricTotal(full)).toBe(40);
    expect(rubricTotalOrNull(full)).toBe(40);
  });

  it("treats a rubric with any missing or out-of-range field as incomplete", () => {
    expect(isScoreComplete(full)).toBe(true);
    expect(isScoreComplete({ ...full, technique: null })).toBe(false);
    expect(isScoreComplete({ ...full, technique: 11 })).toBe(false);
    expect(isScoreComplete({ ...full, technique: 7.5 })).toBe(false);
    expect(isScoreComplete(null)).toBe(false);
    expect(rubricTotalOrNull({ ...full, formations: null })).toBeNull();
  });

  it("counts filled fields", () => {
    expect(rubricFilledCount({ ...full, technique: null, formations: null })).toBe(3);
    expect(rubricFilledCount(undefined)).toBe(0);
  });

  it("parses only whole numbers from 0 to 10", () => {
    expect(parseRubricScore("0")).toBe(0);
    expect(parseRubricScore("10")).toBe(10);
    expect(parseRubricScore(7)).toBe(7);
    expect(parseRubricScore("11")).toBeNull();
    expect(parseRubricScore("-1")).toBeNull();
    expect(parseRubricScore("7.5")).toBeNull();
    expect(parseRubricScore("abc")).toBeNull();
  });
});

describe("zScores", () => {
  it("returns zeros when every total is equal, and an empty list for no totals", () => {
    expect(zScores([])).toEqual([]);
    expect(zScores([30, 30, 30])).toEqual([0, 0, 0]);
  });

  it("centers on zero with unit spread", () => {
    const zs = zScores([10, 20, 30]);
    expect(zs[0]).toBeCloseTo(-1.2247, 3);
    expect(zs[1]).toBeCloseTo(0, 6);
    expect(zs[2]).toBeCloseTo(1.2247, 3);
  });
});

describe("viewingNeighbors", () => {
  it("finds previous and next positions in sorted order", () => {
    expect(viewingNeighbors([3, 1, 2], 2)).toEqual({ index: 1, prev: 1, next: 3 });
    expect(viewingNeighbors([1, 2, 3], 1)).toEqual({ index: 0, prev: null, next: 2 });
    expect(viewingNeighbors([1, 2, 3], 3)).toEqual({ index: 2, prev: 2, next: null });
    expect(viewingNeighbors([1, 2, 3], 9)).toEqual({ index: -1, prev: null, next: null });
  });
});

describe("shuffleCopy", () => {
  it("keeps every item and leaves the input untouched", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleCopy(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
  });
});
