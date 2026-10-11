import { describe, expect, it } from "vitest";
import { moderatorResultsReady } from "@/lib/judge-panel-completion";

const completeScore = {
  choreography: 8,
  formations: 8,
  technique: 8,
  syncCleanliness: 8,
  overallImpression: 8,
};
const applications = [{ id: "team-1" }, { id: "team-2" }];

function judge(submitted: boolean, complete = true) {
  return {
    submittedAt: submitted ? new Date() : null,
    slots: applications.map(({ id }) => ({
      applicationId: id,
      score: complete ? completeScore : null,
    })),
  };
}

describe("moderatorResultsReady", () => {
  it("refuses rankings when only one of several active judges submitted", () => {
    expect(moderatorResultsReady(
      applications,
      [judge(true), judge(false), judge(false)],
      0,
    )).toBe(false);
  });

  it("requires complete submitted packets and no unresolved judge invites", () => {
    expect(moderatorResultsReady(
      applications,
      [judge(true), judge(true)],
      1,
    )).toBe(false);
    expect(moderatorResultsReady(
      applications,
      [judge(true), judge(true, false)],
      0,
    )).toBe(false);
    expect(moderatorResultsReady(
      applications,
      [judge(true), judge(true)],
      0,
    )).toBe(true);
  });
});
