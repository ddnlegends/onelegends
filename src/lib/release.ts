/** Finalization is explicit and serialized with scoring and roster changes. */
import { prisma } from "@/lib/prisma";
import { judgePanelCompletion } from "@/lib/judge-panel-completion";

export async function finalizeResults(competitionId: string, actorEmail: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({
      where: { id: competitionId },
      select: {
        resultsReleasedAt: true,
        applications: { select: { id: true } },
        judgeInvites: { select: { id: true }, take: 1 },
        judgeAssignments: {
          where: { status: { in: ["APPROVED", "PENDING"] } },
          select: {
            status: true,
            submittedAt: true,
            slots: { select: { applicationId: true, score: true } },
          },
        },
      },
    });
    if (!competition) return { error: "Competition not found." };
    if (competition.resultsReleasedAt) return { error: "Results have already been finalized." };
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
