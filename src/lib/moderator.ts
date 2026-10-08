import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Non-partner competition admins run the same live console as assigned moderators. */
function moderatorCompetitionWhere(userId: string): Prisma.CompetitionProfileWhereInput {
  return {
    // A judge must never gain access to the videos they are scoring.
    judgeAssignments: { none: { status: "APPROVED", judge: { userId } } },
    OR: [
      { moderatorAccess: { some: { userId } } },
      {
        isPartner: false,
        OR: [
          { userId }, // Legacy primary owner, before competition memberships existed.
          { memberships: { some: { userId, status: "APPROVED", isAdmin: true } } },
        ],
      },
    ],
  };
}

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
    const competition = await prisma.competitionProfile.findFirst({
      where: { id: competitionId, ...moderatorCompetitionWhere(userId) },
      select: { id: true },
    });
    return Boolean(competition);
  },
);

export const hasAnyModeratorAccess = cache(async (userId: string) => {
  const competition = await prisma.competitionProfile.findFirst({
    where: moderatorCompetitionWhere(userId),
    select: { id: true },
  });
  return Boolean(competition);
});

export const getModeratorCompetitions = cache(async (userId: string) => {
  return prisma.competitionProfile.findMany({
    where: moderatorCompetitionWhere(userId),
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
    orderBy: { name: "asc" },
  });
});
