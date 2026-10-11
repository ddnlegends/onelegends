export type ResetMode = "full" | "soft";

export function getTeamResetPlan(mode: ResetMode) {
  if (mode === "soft") {
    return {
      preserveClaimCode: true,
      preserveProfile: true,
      preserveAdminInfo: true,
      clearApplications: true,
      clearDancers: false,
      clearMemberships: false,
      clearInvites: false,
      rotateClaimCode: false,
    };
  }

  return {
    preserveClaimCode: false,
    preserveProfile: false,
    preserveAdminInfo: false,
    clearApplications: true,
    clearDancers: true,
    clearMemberships: true,
    clearInvites: true,
    rotateClaimCode: true,
  };
}

export function getCompetitionResetPlan(mode: ResetMode) {
  if (mode === "soft") {
    return {
      preserveClaimCode: true,
      preserveProfile: true,
      preserveAdminInfo: true,
      clearApplications: true,
      clearJudgeResults: true,
      clearJudgeInvites: true,
      clearModeratorAccess: false,
      clearMemberships: false,
      clearCompInvites: false,
      rotateClaimCode: false,
    };
  }

  return {
    preserveClaimCode: false,
    preserveProfile: false,
    preserveAdminInfo: false,
    clearApplications: true,
    clearJudgeResults: true,
    clearJudgeInvites: true,
    clearModeratorAccess: true,
    clearMemberships: true,
    clearCompInvites: true,
    rotateClaimCode: true,
  };
}
