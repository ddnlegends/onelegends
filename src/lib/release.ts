/**
 * Releases a competition's results once enough judges have submitted.
 *
 * Server-only (it pulls in the Google Sheets client). The conditional
 * `updateMany` on `resultsReleasedAt: null` makes release happen exactly once,
 * even when the last judges submit at the same moment; only that winning call
 * syncs the applicant sheet. Release closes judging and clears the live team.
 */
import { prisma } from "@/lib/prisma";
import { syncCompetitionSheet } from "@/lib/sheets";

export async function maybeReleaseResults(competitionId: string) {
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    include: {
      judgeAssignments: {
        where: { status: "APPROVED", submittedAt: { not: null } },
        select: { id: true },
      },
    },
  });
  if (!competition) return false;
  if (competition.resultsReleasedAt) return true;

  const completed = competition.judgeAssignments.length;
  if (completed < competition.requiredJudgeCount) return false;

  const released = await prisma.competitionProfile.updateMany({
    where: { id: competitionId, resultsReleasedAt: null },
    data: {
      resultsReleasedAt: new Date(),
      judgingOpen: false,
      livePosition: null,
      liveUpdatedAt: null,
    },
  });
  if (released.count > 0) {
    await syncCompetitionSheet(competitionId).catch(() => null);
  }
  return true;
}
