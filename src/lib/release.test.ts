import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { maybeReleaseNonPartnerResults } from "@/lib/release";

const score = {
  choreography: 8,
  formations: 8,
  technique: 8,
  syncCleanliness: 8,
  overallImpression: 8,
};

function panel() {
  return {
    isPartner: false,
    isAffiliate: false,
    judgingOpen: true,
    resultsReleasedAt: null,
    applications: [{ id: "application-1" }],
    judgeInvites: [{ id: "invite-1" }],
    judgeAssignments: [{
      status: "APPROVED",
      submittedAt: new Date(),
      slots: [{ applicationId: "application-1", score }],
    }],
  };
}

describe("Non-partner result release", () => {
  it("waits for pending judges, then releases when the full panel is resolved", async () => {
    const competition = panel();
    const findUnique = vi.fn().mockImplementation(async () => competition);
    const update = vi.fn();
    const tx = { competitionProfile: { findUnique, update } } as unknown as Prisma.TransactionClient;

    expect(await maybeReleaseNonPartnerResults(tx, "competition-1")).toBe(false);
    expect(update).not.toHaveBeenCalled();

    competition.judgeInvites = [];
    expect(await maybeReleaseNonPartnerResults(tx, "competition-1")).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "competition-1" },
      data: expect.objectContaining({ judgingOpen: false, resultsReleasedAt: expect.any(Date) }),
    }));
  });

  it("does not auto-release Partner results", async () => {
    const competition = { ...panel(), isPartner: true, judgeInvites: [] };
    const update = vi.fn();
    const tx = { competitionProfile: { findUnique: vi.fn().mockResolvedValue(competition), update } } as unknown as Prisma.TransactionClient;
    expect(await maybeReleaseNonPartnerResults(tx, "competition-1")).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
