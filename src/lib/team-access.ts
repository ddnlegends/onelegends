import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateCompClaimCode, generateTeamClaimCode } from "@/lib/claim-code";

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

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platformAdmin: true },
  });
  return Boolean(user?.platformAdmin);
}

export async function getApprovedTeamMemberships(userId: string) {
  return prisma.teamMembership.findMany({
    where: { userId, status: "APPROVED" },
    include: { team: true },
    orderBy: { team: { name: "asc" } },
  });
}

export async function getApprovedCompMemberships(userId: string) {
  return prisma.competitionMembership.findMany({
    where: { userId, status: "APPROVED" },
    include: { competition: true },
    orderBy: { competition: { name: "asc" } },
  });
}

export async function getActiveTeamId(userId: string): Promise<string | null> {
  const approved = await getApprovedTeamMemberships(userId);
  if (approved.length === 0) return null;
  const jar = await cookies();
  const fromCookie = jar.get(ACTIVE_TEAM_COOKIE)?.value;
  if (fromCookie && approved.some((m) => m.teamId === fromCookie)) {
    return fromCookie;
  }
  return approved[0].teamId;
}

export async function getActiveCompetitionId(
  userId: string,
): Promise<string | null> {
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
}

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

export async function userHasTeamAccess(userId: string): Promise<boolean> {
  const count = await prisma.teamMembership.count({
    where: { userId, status: "APPROVED" },
  });
  return count > 0;
}

export async function userHasCompAccess(userId: string): Promise<boolean> {
  const count = await prisma.competitionMembership.count({
    where: { userId, status: "APPROVED" },
  });
  if (count > 0) return true;
  const legacy = await prisma.competitionProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return Boolean(legacy);
}

export async function userHasJudgeAccess(userId: string): Promise<boolean> {
  const judge = await prisma.judgeProfile.findUnique({
    where: { userId },
    include: { assignments: { where: { status: "APPROVED" }, take: 1 } },
  });
  return Boolean(judge && judge.assignments.length > 0);
}

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
