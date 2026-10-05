import { describe, expect, it } from "vitest";
import { rankTeams } from "@/lib/results";

function rubric(each: number) {
  return {
    choreography: each,
    formations: each,
    technique: each,
    syncCleanliness: each,
    overallImpression: each,
  };
}

const apps = ["a", "b", "c"].map((id, index) => ({
  id,
  teamId: `team-${id}`,
  status: "PENDING" as const,
  viewingPosition: index + 1,
  team: { name: `Team ${id.toUpperCase()}` },
}));

describe("rankTeams", () => {
  it("ranks by average z-score so a harsh judge counts as much as a generous one", () => {
    const ranked = rankTeams(apps, [
      {
        judge: { name: "Generous" },
        slots: [
          { applicationId: "a", score: rubric(10) },
          { applicationId: "b", score: rubric(9) },
          { applicationId: "c", score: rubric(8) },
        ],
      },
      {
        judge: { name: "Harsh" },
        slots: [
          { applicationId: "a", score: rubric(1) },
          { applicationId: "b", score: rubric(3) },
          { applicationId: "c", score: rubric(2) },
        ],
      },
    ]);

    // Average z: a=0, b≈0.61, c≈-0.61. Team A wins the generous judge's sheet but
    // finishes last on the harsh judge's, so it lands in the middle.
    expect(ranked.map((row) => row.applicationId)).toEqual(["b", "a", "c"]);
    expect(ranked[0].avgTotal).toBe(30);
    expect(ranked[0].judges).toHaveLength(2);
  });

  it("skips incomplete scores and keeps teams with no scores at the bottom", () => {
    const ranked = rankTeams(apps, [
      {
        judge: { name: "Only" },
        slots: [
          { applicationId: "a", score: rubric(6) },
          { applicationId: "b", score: { ...rubric(9), technique: null } },
          { applicationId: "c", score: rubric(4) },
        ],
      },
    ]);

    const b = ranked.find((row) => row.applicationId === "b");
    expect(b?.judges).toHaveLength(0);
    expect(b?.avgTotal).toBe(0);
    expect(ranked[0].applicationId).toBe("a");
  });

  it("keeps the judge comment, trimmed", () => {
    const ranked = rankTeams(apps.slice(0, 1), [
      {
        judge: { name: "J" },
        slots: [{ applicationId: "a", score: { ...rubric(5), comment: "  Clean lines  " } }],
      },
    ]);
    expect(ranked[0].judges[0].comment).toBe("Clean lines");
  });

  it("ignores scores for applications that are not in the list", () => {
    const ranked = rankTeams(apps.slice(0, 1), [
      {
        judge: { name: "J" },
        slots: [
          { applicationId: "a", score: rubric(5) },
          { applicationId: "ghost", score: rubric(10) },
        ],
      },
    ]);
    expect(ranked).toHaveLength(1);
  });
});
