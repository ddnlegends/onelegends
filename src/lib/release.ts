/** Release is serialized with scoring, closing, and judge-count updates. */
import { prisma } from "@/lib/prisma";
import { syncCompetitionSheet } from "@/lib/sheets";

export async function maybeReleaseResults(competitionId: string) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({
      where: { id: competitionId },
      include: {
        judgeAssignments: {
          where: { status: "APPROVED", submittedAt: { not: null } },
          select: { id: true },
        },
      },
    });
    if (!competition) return "waiting";
    if (competition.resultsReleasedAt) return "already-released";
    if (competition.judgeAssignments.length < competition.requiredJudgeCount) return "waiting";
    await tx.competitionProfile.update({
      where: { id: competitionId },
      data: {
        resultsReleasedAt: new Date(),
        judgingOpen: false,
        livePosition: null,
        liveUpdatedAt: null,
      },
    });
    return "released";
  });
  if (result === "released") {
    await syncCompetitionSheet(competitionId).catch(() => null);
  }
  return result !== "waiting";
}
