import { describe, expect, it } from "vitest";
import { competitionApplicationClosureReasons, competitionProfileGaps, isCompetitionVisibleToTeams } from "@/lib/competition-profile";

const details = {
  dates: "TBD",
  location: "Test City",
  venue: "N/A",
  stageSize: "40 x 32 feet",
  lighting: "TBD",
  productionNotes: "N/A",
  description: "Fixture competition",
};

describe("competition listing readiness", () => {
  it("requires a claim and every text detail while allowing N/A and TBD", () => {
    expect(competitionProfileGaps(details)).toEqual([]);
    expect(isCompetitionVisibleToTeams({ ...details, claimedAt: null })).toBe(false);
    expect(isCompetitionVisibleToTeams({ ...details, claimedAt: new Date() })).toBe(true);
    expect(competitionProfileGaps({ ...details, lighting: "   " })).toEqual(["AV guidelines"]);
    expect(isCompetitionVisibleToTeams({ ...details, lighting: "   ", claimedAt: new Date() })).toBe(false);
  });
});

describe("admin application closure reasons", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const ready = {
    ...details,
    claimedAt: new Date("2026-10-01T12:00:00Z"),
    acceptingApps: true,
    applicationDeadline: new Date("2026-10-30T12:00:00Z"),
    resultsReleasedAt: null,
  };

  it("shows no reason while a claimed, complete competition is open", () => {
    expect(competitionApplicationClosureReasons(ready, now)).toEqual([]);
  });

  it("shows missing details and the disabled switch without conflating them", () => {
    expect(competitionApplicationClosureReasons({ ...ready, venue: "", acceptingApps: false }, now)).toEqual([
      "Comp Details incomplete: Venue",
      "Accepting Applications is turned off",
    ]);
  });

  it("uses the effective final cutoff and includes other blockers", () => {
    expect(competitionApplicationClosureReasons({
      ...ready,
      claimedAt: null,
      applicationClosesAt: new Date("2026-10-19T12:00:00Z"),
      resultsReleasedAt: now,
    }, now)).toEqual([
      "Not claimed by a host",
      "Results have been released",
      "Final application deadline has passed",
    ]);
  });
});
