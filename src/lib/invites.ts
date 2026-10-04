import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { applyPlatformAdminInvite } from "@/lib/ops-admin";
import { applyRegistrationInvites } from "@/lib/registration";

export async function hydrateEmailInvites(userId: string, email: string) {
  await applyPlatformAdminInvite(userId, email);
  await applyRegistrationInvites(userId, email);
  if (!prisma.teamInvite || !prisma.compInvite) return;

  const [teamInvites, compInvites] = await Promise.all([
    prisma.teamInvite.findMany({ where: { email } }),
    prisma.compInvite.findMany({ where: { email } }),
  ]);
  for (const invite of teamInvites) {
    const existing = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId: invite.teamId } },
    });
    if (existing?.status !== "APPROVED") {
      await prisma.teamMembership.upsert({
        where: { userId_teamId: { userId, teamId: invite.teamId } },
        create: {
          userId,
          teamId: invite.teamId,
          status: "PENDING",
          isAdmin: true,
          isPrimary: false,
        },
        update: {
          status: "PENDING",
          isAdmin: true,
          isPrimary: false,
          decidedAt: null,
          requestedAt: new Date(),
        },
      });
    }
    await prisma.teamInvite.delete({ where: { id: invite.id } });
  }

  for (const invite of compInvites) {
    const existing = await prisma.competitionMembership.findUnique({
      where: {
        userId_competitionId: { userId, competitionId: invite.competitionId },
      },
    });
    if (existing?.status !== "APPROVED") {
      await prisma.competitionMembership.upsert({
        where: {
          userId_competitionId: {
            userId,
            competitionId: invite.competitionId,
          },
        },
        create: {
          userId,
          competitionId: invite.competitionId,
          status: "PENDING",
          isAdmin: true,
          isPrimary: false,
        },
        update: {
          status: "PENDING",
          isAdmin: true,
          isPrimary: false,
          decidedAt: null,
          requestedAt: new Date(),
        },
      });
    }
    await prisma.compInvite.delete({ where: { id: invite.id } });
  }
}

export const getPendingInvites = cache(async (userId: string, email: string) => {
  try {
    const [teamInviteCount, compInviteCount, regInviteCount] = await Promise.all([
      prisma.teamInvite.count({ where: { email } }),
      prisma.compInvite.count({ where: { email } }),
      prisma.registrationInvite.count({ where: { email } }),
    ]);
    if (teamInviteCount + compInviteCount + regInviteCount > 0) {
      await hydrateEmailInvites(userId, email);
    }
  } catch {
    /* Account still loads even if invite hydration fails. */
  }

  const [teams, comps, judges] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { userId, status: "PENDING" },
      include: { team: { select: { id: true, name: true } } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.competitionMembership.findMany({
      where: { userId, status: "PENDING" },
      include: { competition: { select: { id: true, name: true } } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.judgeInvite.findMany({
      where: { email },
      include: { competition: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { teams, comps, judges };
});
