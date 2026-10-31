import { describe, expect, it } from "vitest";
import { offerStatusLabel, PARTNER_CONFIRMATION_LIMIT } from "@/lib/application-offers";

describe("application offer labels", () => {
  const announced = new Date("2026-10-30T12:00:00Z");

  it("does not disclose a saved host decision before final submission", () => {
    expect(offerStatusLabel({ status: "ACCEPTED", teamOfferResponse: "NONE", decisionsSubmittedAt: null }))
      .toBe("Decision not announced");
  });

  it("distinguishes an offer from a team-confirmed spot", () => {
    expect(offerStatusLabel({ status: "ACCEPTED", teamOfferResponse: "NONE", decisionsSubmittedAt: announced }))
      .toBe("Offer · response needed");
    expect(offerStatusLabel({ status: "ACCEPTED", teamOfferResponse: "CONFIRMED", decisionsSubmittedAt: announced }))
      .toBe("Confirmed by team");
  });

  it("separates team declines, host declines, waitlists, and cap closures", () => {
    expect(offerStatusLabel({ status: "ACCEPTED", teamOfferResponse: "DECLINED", decisionsSubmittedAt: announced }))
      .toBe("Declined by team");
    expect(offerStatusLabel({ status: "DECLINED", teamOfferResponse: "NONE", decisionsSubmittedAt: announced }))
      .toBe("Declined by competition");
    expect(offerStatusLabel({ status: "WAITLISTED", teamOfferResponse: "NONE", decisionsSubmittedAt: announced }))
      .toBe("Waitlisted");
    expect(offerStatusLabel({ status: "WAITLISTED", teamOfferResponse: "CAP_CLOSED", decisionsSubmittedAt: announced }))
      .toBe("Unavailable · Partner limit reached");
    expect(PARTNER_CONFIRMATION_LIMIT).toBe(3);
  });
});
