import { describe, expect, it } from "vitest";
import { canTeamWithdrawApplication } from "@/lib/application-withdrawal";

const now = new Date("2026-10-20T12:00:00Z");
const active = {
  removedAt: null,
  viewingPosition: null,
  competition: {
    dates: "TBD",
    location: "Boston",
    venue: "N/A",
    stageSize: "40 x 32",
    lighting: "TBD",
    productionNotes: "N/A",
    description: "Competition",
    claimedAt: new Date("2026-10-01T12:00:00Z"),
    acceptingApps: true,
    applicationDeadline: new Date("2026-10-30T12:00:00Z"),
    judgingOpen: false,
    resultsReleasedAt: null,
    decisionsSubmittedAt: null,
  },
};

describe("team withdrawal eligibility", () => {
  it("allows withdrawal while applications are live", () => {
    expect(canTeamWithdrawApplication(active, now)).toBe(true);
  });

  it("locks withdrawal when the competition closes, reaches its cutoff, or enters viewing", () => {
    expect(canTeamWithdrawApplication({ ...active, competition: { ...active.competition, acceptingApps: false } }, now)).toBe(false);
    expect(canTeamWithdrawApplication({ ...active, competition: { ...active.competition, applicationClosesAt: new Date("2026-10-19T12:00:00Z") } }, now)).toBe(false);
    expect(canTeamWithdrawApplication({ ...active, viewingPosition: 1 }, now)).toBe(false);
    expect(canTeamWithdrawApplication({ ...active, competition: { ...active.competition, judgingOpen: true } }, now)).toBe(false);
  });

  it("does not allow a removed or hidden application to be withdrawn again", () => {
    expect(canTeamWithdrawApplication({ ...active, removedAt: now }, now)).toBe(false);
    expect(canTeamWithdrawApplication({ ...active, competition: { ...active.competition, venue: "" } }, now)).toBe(false);
  });
});
