import { isCompetitionOpen } from "@/lib/judging-rules";
import { isCompetitionVisibleToTeams, type CompetitionDetails } from "@/lib/competition-profile";

export function canTeamWithdrawApplication(application: {
  removedAt: Date | null;
  viewingPosition: number | null;
  competition: CompetitionDetails & {
    claimedAt?: Date | null;
    userId?: string | null;
    acceptingApps: boolean;
    judgingOpen: boolean;
    resultsReleasedAt: Date | null;
    decisionsSubmittedAt: Date | null;
    applicationDeadline: Date | null;
    applicationClosesAt?: Date | null;
  };
}, now = new Date()): boolean {
  return application.removedAt === null &&
    application.viewingPosition === null &&
    !application.competition.judgingOpen &&
    !application.competition.resultsReleasedAt &&
    !application.competition.decisionsSubmittedAt &&
    Boolean(application.competition.claimedAt) &&
    isCompetitionVisibleToTeams(application.competition) &&
    isCompetitionOpen(application.competition, now);
}
