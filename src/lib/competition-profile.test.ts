import { describe, expect, it } from "vitest";
import { competitionProfileGaps, isCompetitionVisibleToTeams } from "@/lib/competition-profile";

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
    expect(competitionProfileGaps({ ...details, lighting: "   " })).toEqual(["Lighting"]);
    expect(isCompetitionVisibleToTeams({ ...details, lighting: "   ", claimedAt: new Date() })).toBe(false);
  });
});
