/** Result transitions serialize with score saves, submissions, and roster changes. */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moderatorResultsReady } from "@/lib/judge-panel-completion";
import { viewingEligibleApplicationWhere } from "@/lib/payment-eligibility";

async function panelSnapshot(tx: Prisma.TransactionClient, competitionId: string) {
  return tx.competitionProfile.findUnique({
    where: { id: competitionId },
    select: {
      isPartner: true,
      resultsValidatedAt: true,
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
}

function panelReady(competition: NonNullable<Awaited<ReturnType<typeof panelSnapshot>>>) {
  return moderatorResultsReady(
    competition.applications,
    competition.judgeAssignments.filter((row) => row.status === "APPROVED"),
    competition.judgeInvites.length + competition.judgeAssignments.filter((row) => row.status === "PENDING").length,
  );
}

/** Called inside a competition-row lock after any change that can finish the Non Partner panel. */
export async function releaseNonPartnerIfReady(tx: Prisma.TransactionClient, competitionId: string) {
  const competition = await panelSnapshot(tx, competitionId);
  if (!competition || competition.isPartner || competition.resultsReleasedAt || !panelReady(competition)) return false;
  await tx.competitionProfile.update({
    where: { id: competitionId },
    data: {
      resultsReleasedAt: new Date(),
      resultsFinalizedByEmail: null,
      judgingOpen: false,
      livePosition: null,
      liveUpdatedAt: null,
    },
  });
  return true;
}

export async function validatePartnerResults(competitionId: string, actorEmail: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await panelSnapshot(tx, competitionId);
    if (!competition) return { error: "Competition not found." };
    if (!competition.isPartner) return { error: "Non Partner results release automatically and do not require tech approval." };
    if (competition.resultsReleasedAt) return { error: "Results are already released." };
    if (competition.resultsValidatedAt) return { error: "Results are already validated." };
    if (!panelReady(competition)) return { error: "Every active judge must submit a complete packet and all pending judge requests and invitations must be resolved." };
    await tx.competitionProfile.update({
      where: { id: competitionId },
      data: {
        resultsValidatedAt: new Date(),
        resultsValidatedByEmail: actorEmail,
        judgingOpen: false,
        livePosition: null,
        liveUpdatedAt: null,
      },
    });
    return { ok: true };
  });
}

export async function releasePartnerResults(competitionId: string, actorEmail: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await panelSnapshot(tx, competitionId);
    if (!competition) return { error: "Competition not found." };
    if (!competition.isPartner) return { error: "Non Partner results release automatically." };
    if (competition.resultsReleasedAt) return { error: "Results are already released." };
    if (!competition.resultsValidatedAt) return { error: "Validate Partner results before release." };
    if (!panelReady(competition)) return { error: "The judge panel changed. Results cannot be released." };
    await tx.competitionProfile.update({
      where: { id: competitionId },
      data: {
        resultsReleasedAt: new Date(),
        resultsFinalizedByEmail: actorEmail,
        judgingOpen: false,
        livePosition: null,
        liveUpdatedAt: null,
      },
    });
    return { ok: true };
  });
}
