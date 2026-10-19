import { describe, expect, it } from "vitest";
import {
  applicationPhaseAt,
  expectedApplicationFee,
  finalApplicationCutoff,
  latestConfiguredDeadline,
} from "@/lib/application-schedule";

const early = new Date("2027-01-01T23:59:00Z");
const regular = new Date("2027-01-08T23:59:00Z");
const late = new Date("2027-01-15T23:59:00Z");
const before = new Date("2027-01-01T12:00:00Z");
const middle = new Date("2027-01-05T12:00:00Z");
const end = new Date("2027-01-12T12:00:00Z");

describe("application periods", () => {
  it("assigns the correct phase and fee for all three periods", () => {
    const schedule = {
      earlyTierDeadline: early, earlyApplicationDeadline: regular, applicationDeadline: late,
      earlyApplicationFeeCents: 2500, regularApplicationFeeCents: 3500, lateApplicationFeeCents: 4500,
    };
    expect(applicationPhaseAt(schedule, before)).toBe("EARLY");
    expect(applicationPhaseAt(schedule, middle)).toBe("REGULAR");
    expect(applicationPhaseAt(schedule, end)).toBe("LATE");
    expect(expectedApplicationFee(schedule, "EARLY")).toBe(2500);
    expect(expectedApplicationFee(schedule, "REGULAR")).toBe(3500);
    expect(expectedApplicationFee(schedule, "LATE")).toBe(4500);
  });

  it("supports Early/Regular, Regular/Late, and a single period", () => {
    expect(applicationPhaseAt({ earlyTierDeadline: early, earlyApplicationDeadline: regular }, middle)).toBe("REGULAR");
    expect(applicationPhaseAt({ earlyApplicationDeadline: regular, applicationDeadline: late }, end)).toBe("LATE");
    expect(applicationPhaseAt({ applicationDeadline: late }, before)).toBe("LATE");
    expect(applicationPhaseAt({}, before)).toBe("REGULAR");
    expect(latestConfiguredDeadline({ earlyTierDeadline: early, earlyApplicationDeadline: regular })).toEqual(regular);
    expect(expectedApplicationFee({ regularApplicationFeeCents: 0 }, "REGULAR")).toBe(0);
  });

  it("keeps the legacy Late cutoff until a new final cutoff is saved", () => {
    expect(finalApplicationCutoff({ earlyApplicationDeadline: regular, applicationDeadline: late })).toEqual(late);
    expect(finalApplicationCutoff({ earlyApplicationDeadline: regular, applicationClosesAt: regular })).toEqual(regular);
    expect(finalApplicationCutoff({ earlyApplicationDeadline: regular })).toBeNull();
  });
});
