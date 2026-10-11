import { describe, expect, it } from "vitest";
import { getCompetitionResetPlan, getTeamResetPlan } from "@/lib/reset-plans";

describe("reset plans", () => {
  it("keeps listing shell and admins for tech-admin team resets while clearing applications", () => {
    const plan = getTeamResetPlan("soft");

    expect(plan).toMatchObject({
      preserveClaimCode: true,
      preserveProfile: true,
      preserveAdminInfo: true,
      clearApplications: true,
      clearDancers: false,
    });
  });

  it("fully wipes a team listing for a claim reset while rotating the code", () => {
    const plan = getTeamResetPlan("full");

    expect(plan).toMatchObject({
      preserveClaimCode: false,
      preserveProfile: false,
      preserveAdminInfo: false,
      clearApplications: true,
      clearDancers: true,
      clearMemberships: true,
    });
  });

  it("keeps competition profile and admin info for a soft reset but clears judges and application history", () => {
    const plan = getCompetitionResetPlan("soft");

    expect(plan).toMatchObject({
      preserveClaimCode: true,
      preserveProfile: true,
      preserveAdminInfo: true,
      clearApplications: true,
      clearJudgeResults: true,
      clearJudgeInvites: true,
    });
  });

  it("fully wipes a competition for a claim reset while rotating the claim code", () => {
    const plan = getCompetitionResetPlan("full");

    expect(plan).toMatchObject({
      preserveClaimCode: false,
      preserveProfile: false,
      preserveAdminInfo: false,
      clearApplications: true,
      clearJudgeResults: true,
      clearJudgeInvites: true,
      clearModeratorAccess: true,
    });
  });
});
