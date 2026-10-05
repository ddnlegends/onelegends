import { describe, expect, it } from "vitest";
import {
  blurEmail,
  generateCompClaimCode,
  generateTeamClaimCode,
  normalizeClaimCode,
} from "@/lib/claim-code";

describe("claim codes", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeClaimCode("  team-ab c12 ")).toBe("TEAM-ABC12");
  });

  it("generates prefixed codes without look-alike characters", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateTeamClaimCode()).toMatch(/^TEAM-[A-HJ-NP-Z2-9]{6}$/);
      expect(generateCompClaimCode()).toMatch(/^COMP-[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it("blurs all but the first two characters of the local part", () => {
    expect(blurEmail("captain@example.org")).toBe("ca***@example.org");
    expect(blurEmail("not-an-email")).toBe("***");
  });
});
