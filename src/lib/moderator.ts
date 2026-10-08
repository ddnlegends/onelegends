import { cache } from "react";
import { prisma } from "@/lib/prisma";

export async function applyModeratorInvites(userId: string, email: string) {
  const invites = await prisma.moderatorInvite.findMany({
    where: { email: email.trim().toLowerCase() },
  });
  for (const invite of invites) {
    const [assignment, judgeInvite] = await Promise.all([
      prisma.judgeAssignment.findFirst({
        where: {
          competitionId: invite.competitionId,
          status: { not: "DENIED" },
          judge: { userId },
        },
        select: { id: true },
      }),
      prisma.judgeInvite.findUnique({
        where: {
          competitionId_email: {
            competitionId: invite.competitionId,
            email: email.trim().toLowerCase(),
          },
        },
        select: { id: true },
      }),
    ]);
    if (assignment || judgeInvite) continue;
    await prisma.moderatorAccess.upsert({
      where: {
        userId_competitionId: { userId, competitionId: invite.competitionId },
      },
      create: { userId, competitionId: invite.competitionId },
      update: {},
    });
    await prisma.moderatorInvite.delete({ where: { id: invite.id } });
  }
}

export const hasModeratorAccess = cache(
  async (userId: string, competitionId: string): Promise<boolean> => {
    const [row, judge] = await Promise.all([
      prisma.moderatorAccess.findUnique({
        where: { userId_competitionId: { userId, competitionId } },
        select: { id: true },
      }),
      prisma.judgeAssignment.findFirst({
        where: { competitionId, status: "APPROVED", judge: { userId } },
        select: { id: true },
      }),
    ]);
    return Boolean(row) && !judge;
  },
);

export const getModeratorCompetitions = cache(async (userId: string) => {
  const rows = await prisma.moderatorAccess.findMany({
    where: { userId },
    include: {
      competition: {
        select: {
          id: true,
          name: true,
          acceptingApps: true,
          applicationDeadline: true,
          claimedAt: true,
          userId: true,
          judgingOpen: true,
          livePosition: true,
          resultsReleasedAt: true,
          _count: { select: { applications: true } },
        },
      },
    },
    orderBy: { competition: { name: "asc" } },
  });
  return rows.map((row) => row.competition);
});
