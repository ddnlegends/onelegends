import { describe, expect, it } from "vitest";
import { hostPaymentFingerprint } from "./host-payment-review";

describe("host payment review", () => {
  it("requires a new review when any payment or eligibility status changes", () => {
    const paidAt = new Date("2026-11-04T12:00:00Z");
    const application = {
      id: "app-1",
      compPaymentReceivedAt: paidAt,
      viewingPosition: null,
      team: { registrationPaidAt: paidAt, applyBlocked: false },
    };
    const original = hostPaymentFingerprint([application], paidAt);
    expect(hostPaymentFingerprint([application], null)).not.toBe(original);
    expect(hostPaymentFingerprint([{ ...application, compPaymentReceivedAt: null }], paidAt)).not.toBe(original);
    expect(hostPaymentFingerprint([{ ...application, team: { ...application.team, registrationPaidAt: null } }], paidAt)).not.toBe(original);
    expect(hostPaymentFingerprint([{ ...application, team: { ...application.team, applyBlocked: true } }], paidAt)).not.toBe(original);
    expect(hostPaymentFingerprint([{ ...application, viewingPosition: 1 }], paidAt)).not.toBe(original);
    expect(hostPaymentFingerprint([], paidAt)).not.toBe(original);
  });
});
