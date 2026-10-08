/**
 * Permission lookups used by pages and actions: platform admin, team and
 * competition admin/primary checks, nav visibility, and the active team or
 * competition (stored in HTTP-only cookies and re-checked against approved
 * membership on every request).
 *
 * Lookups are wrapped in React `cache` so one request asks the database once.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateCompClaimCode, generateTeamClaimCode } from "@/lib/claim-code";
import { getCachedUser } from "@/lib/cached-user";
import { hasAnyModeratorAccess } from "@/lib/moderator";

export const ACTIVE_TEAM_COOKIE = "onelegends-team";
export const ACTIVE_COMP_COOKIE = "onelegends-comp";

export function slugifyTeamName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "team";
}

export async function uniqueTeamSlug(name: string): Promise<string> {
  const base = slugifyTeamName(name);
  let slug = base;
  let n = 2;
  while (await prisma.teamProfile.findUnique({ where: { slug } })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function uniqueTeamClaimCode(): Promise<string> {
  for (let i = 0; i < 24; i += 1) {
    const claimCode = generateTeamClaimCode();
    const exists = await prisma.teamProfile.findUnique({
      where: { claimCode },
      select: { id: true },
    });
    if (!exists) return claimCode;
  }
  throw new Error("Could not generate a unique team claim code.");
}

export async function uniqueCompSlug(name: string): Promise<string> {
  const base = slugifyTeamName(name);
  let slug = base;
  let n = 2;
  while (await prisma.competitionProfile.findUnique({ where: { slug } })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function uniqueCompClaimCode(): Promise<string> {
  for (let i = 0; i < 24; i += 1) {
    const claimCode = generateCompClaimCode();
    const exists = await prisma.competitionProfile.findUnique({
      where: { claimCode },
      select: { id: true },
    });
    if (!exists) return claimCode;
  }
  throw new Error("Could not generate a unique competition claim code.");
}

export async function requireActiveCompetition(userId: string) {
  const competitionId = await getActiveCompetitionId(userId);
  if (!competitionId) return null;
  if (!(await isCompAdmin(userId, competitionId))) return null;
  return prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
}

export const getNavAccess = cache(async (userId: string) => {
  const [user, moderatorAccess] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        platformAdmin: true,
        competition: { select: { id: true } },
        memberships: {
          where: { status: "APPROVED" },
          take: 1,
          select: { id: true },
        },
        competitionMemberships: {
          where: { status: "APPROVED" },
          take: 1,
          select: { id: true },
        },
        judge: {
          select: {
            assignments: {
              where: { status: "APPROVED" },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    }),
    hasAnyModeratorAccess(userId),
  ]);
  const ops = Boolean(user?.platformAdmin);
  return {
    ops,
    moderatorAccess,
    teamAccess: Boolean(user?.memberships.length),
    compAccess:
      ops ||
      Boolean(user?.competitionMemberships.length) ||
      Boolean(user?.competition),
    judgeAccess: Boolean(user?.judge?.assignments.length),
  };
});

export const isPlatformAdmin = cache(async (userId: string): Promise<boolean> => {
  const user = await getCachedUser(userId);
  return Boolean(user?.platformAdmin);
});

export const getApprovedTeamMemberships = cache(async (userId: string) => {
  return prisma.teamMembership.findMany({
    where: { userId, status: "APPROVED" },
    include: { team: true },
    orderBy: { team: { name: "asc" } },
  });
});

export const getApprovedCompMemberships = cache(async (userId: string) => {
  return prisma.competitionMembership.findMany({
    where: { userId, status: "APPROVED" },
    include: { competition: true },
    orderBy: { competition: { name: "asc" } },
  });
});

export const getActiveTeamId = cache(async (userId: string): Promise<string | null> => {
  const approved = await getApprovedTeamMemberships(userId);
  if (approved.length === 0) return null;
  const jar = await cookies();
  const fromCookie = jar.get(ACTIVE_TEAM_COOKIE)?.value;
  if (fromCookie && approved.some((m) => m.teamId === fromCookie)) {
    return fromCookie;
  }
  return approved[0].teamId;
});

export const getActiveCompetitionId = cache(async (
  userId: string,
): Promise<string | null> => {
  if (await isPlatformAdmin(userId)) {
    const jar = await cookies();
    const fromCookie = jar.get(ACTIVE_COMP_COOKIE)?.value;
    if (fromCookie) {
      const listing = await prisma.competitionProfile.findUnique({
        where: { id: fromCookie },
        select: { id: true },
      });
      if (listing) return listing.id;
    }
    const openJudging = await prisma.competitionProfile.findFirst({
      where: { judgingOpen: true, claimedAt: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (openJudging) return openJudging.id;
    const firstClaimed = await prisma.competitionProfile.findFirst({
      where: { claimedAt: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (firstClaimed) return firstClaimed.id;
    const first = await prisma.competitionProfile.findFirst({
      orderBy: { name: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  }

  const approved = await getApprovedCompMemberships(userId);
  if (approved.length === 0) {
    const legacy = await prisma.competitionProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return legacy?.id ?? null;
  }
  const jar = await cookies();
  const fromCookie = jar.get(ACTIVE_COMP_COOKIE)?.value;
  if (fromCookie && approved.some((m) => m.competitionId === fromCookie)) {
    return fromCookie;
  }
  return approved[0].competitionId;
});

export async function setActiveTeamCookie(teamId: string) {
  const jar = await cookies();
  jar.set(ACTIVE_TEAM_COOKIE, teamId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
}

export async function setActiveCompCookie(competitionId: string) {
  const jar = await cookies();
  jar.set(ACTIVE_COMP_COOKIE, competitionId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
}

export const userHasTeamAccess = cache(async (userId: string): Promise<boolean> => {
  const access = await getNavAccess(userId);
  return access.teamAccess;
});

export const userHasCompAccess = cache(async (userId: string): Promise<boolean> => {
  const access = await getNavAccess(userId);
  return access.compAccess;
});

export const userHasJudgeAccess = cache(async (userId: string): Promise<boolean> => {
  const access = await getNavAccess(userId);
  return access.judgeAccess;
});

export async function isTeamPrimary(userId: string, teamId: string) {
  if (await isPlatformAdmin(userId)) return true;
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return Boolean(
    membership?.status === "APPROVED" && membership.isPrimary,
  );
}

export async function isTeamAdmin(userId: string, teamId: string) {
  if (await isPlatformAdmin(userId)) return true;
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return Boolean(membership?.status === "APPROVED" && membership.isAdmin);
}

export async function isCompAdmin(userId: string, competitionId: string) {
  if (await isPlatformAdmin(userId)) return true;
  const membership = await prisma.competitionMembership.findUnique({
    where: { userId_competitionId: { userId, competitionId } },
  });
  return Boolean(membership?.status === "APPROVED" && membership.isAdmin);
}

export async function isCompPrimary(userId: string, competitionId: string) {
  if (await isPlatformAdmin(userId)) return true;
  const membership = await prisma.competitionMembership.findUnique({
    where: { userId_competitionId: { userId, competitionId } },
  });
  return Boolean(
    membership?.status === "APPROVED" && membership.isPrimary,
  );
}
