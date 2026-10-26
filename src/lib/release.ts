/** Partner validation and release serialize with scoring and roster changes. */
import { prisma } from "@/lib/prisma";
import { judgePanelCompletion, moderatorResultsReady } from "@/lib/judge-panel-completion";
import { viewingEligibleApplicationWhere } from "@/lib/payment-eligibility";

export async function finalizeResults(competitionId: string, actorEmail: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({
      where: { id: competitionId },
      select: {
        isPartner: true,
        resultsFinalizedByEmail: true,
        resultsReleasedAt: true,
        applications: { where: viewingEligibleApplicationWhere, select: { id: true } },
        judgeInvites: { select: { id: true }, take: 1 },
        judgeAssignments: {
          where: { status: { in: ["APPROVED", "PENDING"] } },
          select: {
            status: true,
            submittedAt: true,
            slots: { where: { application: viewingEligibleApplicationWhere }, select: { applicationId: true, score: true } },
          },
        },
      },
    });
    if (!competition) return { error: "Competition not found." };
    if (!competition.isPartner) return { error: "Non Partner competitions do not need tech validation." };
    if (competition.resultsReleasedAt) return { error: "Results have already been finalized." };
    if (competition.resultsFinalizedByEmail) return { error: "Results have already been validated." };
    if (!competition.applications.length) return { error: "No teams applied." };
    if (competition.judgeInvites.length || competition.judgeAssignments.some((row) => row.status === "PENDING")) {
      return { error: "Resolve all pending judge invitations and requests before finalizing." };
    }
    const active = competition.judgeAssignments.filter((row) => row.status === "APPROVED");
    if (!active.length) return { error: "At least one approved judge is required." };
    if (!judgePanelCompletion(competition.applications, active).ready) {
      return { error: "Every active judge must submit a complete packet before finalizing." };
    }
    await tx.competitionProfile.update({
      where: { id: competitionId },
      data: {
        resultsFinalizedByEmail: actorEmail,
        judgingOpen: false,
        livePosition: null,
        liveUpdatedAt: null,
      },
    });
    return { ok: true };
  });
}

export async function releaseResults(competitionId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({
      where: { id: competitionId },
      select: {
        isPartner: true, resultsFinalizedByEmail: true, resultsReleasedAt: true,
        applications: { where: viewingEligibleApplicationWhere, select: { id: true } },
        judgeInvites: { select: { id: true } },
        judgeAssignments: {
          where: { status: { in: ["APPROVED", "PENDING"] } },
          select: { status: true, submittedAt: true, slots: { where: { application: viewingEligibleApplicationWhere }, select: { applicationId: true, score: true } } },
        },
      },
    });
    if (!competition?.isPartner) return { error: "Only Partner competitions use tech release." };
    if (!competition.resultsFinalizedByEmail) return { error: "Validate results before releasing them." };
    if (competition.resultsReleasedAt) return { error: "Results have already been released." };
    const active = competition.judgeAssignments.filter((row) => row.status === "APPROVED");
    const unresolved = competition.judgeInvites.length + competition.judgeAssignments.length - active.length;
    if (!moderatorResultsReady(competition.applications, active, unresolved)) {
      return { error: "The judge panel changed after validation. Resolve it before release." };
    }
    await tx.competitionProfile.update({
      where: { id: competitionId },
      data: { resultsReleasedAt: new Date(), judgingOpen: false, livePosition: null, liveUpdatedAt: null },
    });
    return { ok: true };
  });
}
