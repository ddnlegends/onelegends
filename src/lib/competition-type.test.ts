import { describe, expect, it } from "vitest";
import { competitionType, competitionTypeLabel, usesAssignedModerator, usesTechRelease } from "./competition-type";

describe("competition type", () => {
  it.each([
    [{ isPartner: true, isAffiliate: false }, "partner", "Partner", true],
    [{ isPartner: false, isAffiliate: true }, "affiliate", "Affiliate", true],
    [{ isPartner: false, isAffiliate: false }, "non-partner", "Non-partner", false],
  ] as const)("classifies %j", (competition, type, label, assignedModerator) => {
    expect(competitionType(competition)).toBe(type);
    expect(competitionTypeLabel(competition)).toBe(label);
    expect(usesAssignedModerator(competition)).toBe(assignedModerator);
    expect(usesTechRelease(competition)).toBe(assignedModerator);
  });
});
