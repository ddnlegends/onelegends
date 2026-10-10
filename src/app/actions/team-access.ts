"use server";

/**
 * Who belongs to which team or competition: claim codes, admin invites, judge
 * invites, active team/competition selection, and circuit-ops listing tools
 * (create, reset claim, block from applying).
 *
 * Claiming makes the first user the primary admin. Only primaries invite and
 * remove secondary admins. Circuit ops can remove any individual admin and
 * choose a replacement primary. Creating, resetting, and blocking require
 * `platformAdmin`. A reset issues a new claim code and clears access; a
 * competition reset keeps judges once results are released.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { claimAttemptError } from "@/lib/claim-rate-limit";
import { blurEmail, normalizeClaimCode } from "@/lib/claim-code";
import { hasModeratorAccess } from "@/lib/moderator";
import {
  isCompAdmin,
  isCompPrimary,
  isPlatformAdmin,
  isTeamPrimary,
  setActiveCompCookie,
  setActiveTeamCookie,
  uniqueCompClaimCode,
  uniqueCompSlug,
  uniqueTeamClaimCode,
  uniqueTeamSlug,
} from "@/lib/team-access";

function revalidateAccessPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/claim");
  revalidatePath("/profile");
  revalidatePath("/account");
  revalidatePath("/team");
  revalidatePath("/team/access");
  revalidatePath("/team/profile");
  revalidatePath("/team/apply");
  revalidatePath("/comp");
  revalidatePath("/comp/access");
  revalidatePath("/comp/profile");
  revalidatePath("/comp/judges");
  revalidatePath("/comp/results");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/ops/competitions", "layout");
  revalidatePath("/ops/teams", "layout");
  revalidatePath("/moderator", "layout");
  revalidatePath("/judge");
  revalidatePath("/teams");
}

async function primaryEmailForTeam(teamId: string): Promise<string | null> {
  const primary = await prisma.teamMembership.findFirst({
    where: { teamId, isPrimary: true, status: "APPROVED" },
    include: { user: { select: { email: true } } },
  });
  return primary?.user.email ?? null;
}

async function primaryEmailForComp(competitionId: string): Promise<string | null> {
  const primary = await prisma.competitionMembership.findFirst({
    where: { competitionId, isPrimary: true, status: "APPROVED" },
    include: { user: { select: { email: true } } },
  });
  return primary?.user.email ?? null;
}

export async function setActiveTeamAction(formData: FormData) {
  const user = await requireUser();
  if (!user) return;
  const teamId = String(formData.get("teamId") ?? "");
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  });
  if (membership?.status !== "APPROVED") return;
  await setActiveTeamCookie(teamId);
  revalidateAccessPaths();
}

export async function setActiveCompAction(formData: FormData) {
  const user = await requireUser();
  if (!user) return;
  const competitionId = String(formData.get("competitionId") ?? "");
  if (await isPlatformAdmin(user.id)) {
    const listing = await prisma.competitionProfile.findUnique({
      where: { id: competitionId },
      select: { id: true },
    });
    if (!listing) return;
    await setActiveCompCookie(competitionId);
    revalidateAccessPaths();
    return;
  }
  const membership = await prisma.competitionMembership.findUnique({
    where: { userId_competitionId: { userId: user.id, competitionId } },
  });
  if (membership?.status !== "APPROVED") return;
  await setActiveCompCookie(competitionId);
  revalidateAccessPaths();
}

export async function previewTeamClaim(
  _prev: { error?: string; name?: string; claimCode?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; name?: string; claimCode?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) {
    return { error: "Circuit ops does not claim teams." };
  }
  const limited = await claimAttemptError(user.id);
  if (limited) return { error: limited };
  const code = normalizeClaimCode(String(formData.get("claimCode") ?? ""));
  if (code.length < 4) return { error: "Enter a team claim code." };
  const team = await prisma.teamProfile.findUnique({ where: { claimCode: code } });
  if (!team) return { error: "That claim code is not valid." };
  if (team.claimedAt) {
    const email = await primaryEmailForTeam(team.id);
    return {
      error: email
        ? `That team is already claimed (${blurEmail(email)}).`
        : "That team is already claimed.",
    };
  }
  return { name: team.name, claimCode: team.claimCode };
}

export async function previewCompClaim(
  _prev: { error?: string; name?: string; claimCode?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; name?: string; claimCode?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) {
    return { error: "Circuit ops does not claim competitions." };
  }
  const limited = await claimAttemptError(user.id);
  if (limited) return { error: limited };
  const code = normalizeClaimCode(String(formData.get("claimCode") ?? ""));
  if (code.length < 4) return { error: "Enter a competition claim code." };
  const listing = await prisma.competitionProfile.findUnique({
    where: { claimCode: code },
  });
  if (!listing) return { error: "That claim code is not valid." };
  if (listing.claimedAt || listing.userId) {
    const email = await primaryEmailForComp(listing.id);
    return {
      error: email
        ? `That competition is already claimed (${blurEmail(email)}).`
        : "That competition is already claimed.",
    };
  }

  if (!listing.isPartner && await prisma.judgeAssignment.findFirst({
    where: { competitionId: listing.id, status: "APPROVED", judge: { userId: user.id } },
    select: { id: true },
  })) {
    return { error: "Judges cannot claim a non-partner competition they score." };
  }
  return { name: listing.name, claimCode: listing.claimCode };
}

export async function claimTeamAction(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) {
    return { error: "Circuit ops does not claim teams." };
  }

  const limited = await claimAttemptError(user.id);
  if (limited) return { error: limited };
  const code = normalizeClaimCode(String(formData.get("claimCode") ?? ""));
  if (code.length < 4) return { error: "Enter a team claim code." };

  const team = await prisma.teamProfile.findUnique({ where: { claimCode: code } });
  if (!team) return { error: "That claim code is not valid." };

  if (team.claimedAt) {
    const email = await primaryEmailForTeam(team.id);
    return {
      error: email
        ? `That team is already claimed (${blurEmail(email)}).`
        : "That team is already claimed.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.teamProfile.updateMany({
        where: { id: team.id, claimedAt: null, claimCode: code },
        data: { claimedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("CLAIM_TAKEN");
      await tx.teamMembership.upsert({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
        create: {
          userId: user.id,
          teamId: team.id,
          status: "APPROVED",
          isAdmin: true,
          isPrimary: true,
          decidedAt: new Date(),
        },
        update: {
          status: "APPROVED",
          isAdmin: true,
          isPrimary: true,
          decidedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLAIM_TAKEN") {
      const email = await primaryEmailForTeam(team.id);
      return {
        error: email
          ? `That team is already claimed (${blurEmail(email)}).`
          : "That team was just claimed.",
      };
    }
    throw error;
  }

  await setActiveTeamCookie(team.id);
  revalidateAccessPaths();
  return { ok: true, message: `You’re the primary admin for ${team.name}.` };
}

export async function claimCompAction(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (await isPlatformAdmin(user.id)) {
    return { error: "Circuit ops does not claim competitions." };
  }

  const limited = await claimAttemptError(user.id);
  if (limited) return { error: limited };
  const code = normalizeClaimCode(String(formData.get("claimCode") ?? ""));
  if (code.length < 4) return { error: "Enter a competition claim code." };

  const listing = await prisma.competitionProfile.findUnique({
    where: { claimCode: code },
  });
  if (!listing) return { error: "That claim code is not valid." };

  if (listing.claimedAt || listing.userId) {
    const email = await primaryEmailForComp(listing.id);
    return {
      error: email
        ? `That competition is already claimed (${blurEmail(email)}).`
        : "That competition is already claimed.",
    };
  }

  if (!listing.isPartner && await prisma.judgeAssignment.findFirst({
    where: { competitionId: listing.id, status: "APPROVED", judge: { userId: user.id } },
    select: { id: true },
  })) {
    return { error: "Judges cannot claim a non-partner competition they score." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.competitionProfile.updateMany({
        where: { id: listing.id, userId: null, claimedAt: null, claimCode: code },
        data: { userId: user.id, claimedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("CLAIM_TAKEN");
      await tx.competitionMembership.upsert({
        where: {
          userId_competitionId: { userId: user.id, competitionId: listing.id },
        },
        create: {
          userId: user.id,
          competitionId: listing.id,
          status: "APPROVED",
          isAdmin: true,
          isPrimary: true,
          decidedAt: new Date(),
        },
        update: {
          status: "APPROVED",
          isAdmin: true,
          isPrimary: true,
          decidedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLAIM_TAKEN") {
      const email = await primaryEmailForComp(listing.id);
      return {
        error: email
          ? `That competition is already claimed (${blurEmail(email)}).`
          : "That competition was just claimed.",
      };
    }
    throw error;
  }

  await setActiveCompCookie(listing.id);
  revalidateAccessPaths();
  return { ok: true, message: `You’re the primary admin for ${listing.name}.` };
}

export async function acceptTeamInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await prisma.teamMembership.findFirst({
    where: { id: membershipId, userId: user.id, status: "PENDING" },
  });
  if (!membership) return { error: "That team request was not found." };

  await prisma.teamMembership.update({
    where: { id: membership.id },
    data: { status: "APPROVED", isAdmin: true, decidedAt: new Date() },
  });
  await setActiveTeamCookie(membership.teamId);
  revalidateAccessPaths();
  return { ok: true };
}

export async function acceptCompInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await prisma.competitionMembership.findFirst({
    where: { id: membershipId, userId: user.id, status: "PENDING" },
    include: { competition: { select: { isPartner: true } } },
  });
  if (!membership) return { error: "That competition request was not found." };

  if (!membership.competition.isPartner && await prisma.judgeAssignment.findFirst({
    where: { competitionId: membership.competitionId, status: "APPROVED", judge: { userId: user.id } },
    select: { id: true },
  })) {
    return { error: "Judges cannot admin a non-partner competition they score." };
  }

  await prisma.competitionMembership.update({
    where: { id: membership.id },
    data: { status: "APPROVED", isAdmin: true, decidedAt: new Date() },
  });
  await setActiveCompCookie(membership.competitionId);
  revalidateAccessPaths();
  return { ok: true };
}

export async function acceptJudgeInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const inviteId = String(formData.get("inviteId") ?? "");
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { error: "Account not found." };
  const invite = await prisma.judgeInvite.findFirst({
    where: { id: inviteId, email: dbUser.email },
  });
  if (!invite) return { error: "That judging invite was not found." };
  const [moderatorAccess, moderatorInvite] = await Promise.all([
    hasModeratorAccess(user.id, invite.competitionId),
    prisma.moderatorInvite.findUnique({
      where: {
        competitionId_email: {
          competitionId: invite.competitionId,
          email: dbUser.email,
        },
      },
      select: { id: true },
    }),
  ]);
  if (moderatorAccess || moderatorInvite) {
    return { error: "Moderators for this competition cannot judge it." };
  }

  const name = dbUser.name.trim() || dbUser.email.split("@")[0] || "Judge";

  const judge = await prisma.judgeProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, name },
    update: {},
  });

  const accepted = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${invite.competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({ where: { id: invite.competitionId }, select: { resultsReleasedAt: true } });
    if (!competition || competition.resultsReleasedAt) return false;
    const pendingInvite = await tx.judgeInvite.findUnique({ where: { id: invite.id }, select: { id: true } });
    if (!pendingInvite) return false;
    const existing = await tx.judgeAssignment.findUnique({ where: { judgeId_competitionId: { judgeId: judge.id, competitionId: invite.competitionId } }, select: { status: true } });
    if (existing?.status === "REMOVED") return false;
    await tx.judgeAssignment.upsert({
      where: { judgeId_competitionId: { judgeId: judge.id, competitionId: invite.competitionId } },
      create: { judgeId: judge.id, competitionId: invite.competitionId, status: "APPROVED", decidedAt: new Date() },
      update: { status: "APPROVED", decidedAt: new Date() },
    });
    await tx.judgeInvite.delete({ where: { id: invite.id } });
    return true;
  });
  if (!accepted) return { error: "This invite is no longer available or the judge was removed." };
  revalidateAccessPaths();
  return { ok: true };
}

export async function cancelJudgeInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const inviteId = String(formData.get("inviteId") ?? "");
  const invite = await prisma.judgeInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite) return { error: "Invite not found." };
  if (!(await isCompAdmin(user.id, invite.competitionId))) {
    return { error: "Only competition admins can cancel judge invites." };
  }
  await prisma.judgeInvite.delete({ where: { id: invite.id } });
  revalidateAccessPaths();
  return { ok: true };
}

export async function inviteTeamAdmin(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = z
    .object({
      teamId: z.string().min(1),
      email: z.string().email("Enter a valid email."),
    })
    .safeParse({
      teamId: String(formData.get("teamId") ?? ""),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const { teamId, email } = parsed.data;
  if (!(await isTeamPrimary(user.id, teamId))) {
    return { error: "Only the primary admin can invite secondary admins." };
  }
  if (email === user.email?.toLowerCase()) {
    return { error: "You already admin this team." };
  }

  const account = await prisma.user.findUnique({ where: { email } });
  if (account) {
    const existing = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: account.id, teamId } },
    });
    if (existing?.status === "APPROVED") {
      return { error: "That person is already an admin of this team." };
    }
    await prisma.teamMembership.upsert({
      where: { userId_teamId: { userId: account.id, teamId } },
      create: {
        userId: account.id,
        teamId,
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
    await prisma.teamInvite.deleteMany({ where: { teamId, email } });
    revalidateAccessPaths();
    return {
      ok: true,
      message: `Request sent to ${email}. They’ll see it the next time they log in.`,
    };
  }

  await prisma.teamInvite.upsert({
    where: { teamId_email: { teamId, email } },
    create: { teamId, email },
    update: {},
  });
  revalidateAccessPaths();
  return {
    ok: true,
    message: `Request sent to ${email}. After they create an account, they’ll be asked to approve it.`,
  };
}

export async function inviteCompAdmin(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = z
    .object({
      competitionId: z.string().min(1),
      email: z.string().email("Enter a valid email."),
    })
    .safeParse({
      competitionId: String(formData.get("competitionId") ?? ""),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const { competitionId, email } = parsed.data;
  if (!(await isCompPrimary(user.id, competitionId))) {
    return { error: "Only the primary admin can invite secondary admins." };
  }
  if (email === user.email?.toLowerCase()) {
    return { error: "You already admin this competition." };
  }

  const account = await prisma.user.findUnique({ where: { email } });
  if (account) {
    const existing = await prisma.competitionMembership.findUnique({
      where: {
        userId_competitionId: { userId: account.id, competitionId },
      },
    });
    if (existing?.status === "APPROVED") {
      return { error: "That person is already an admin of this competition." };
    }
    const competition = await prisma.competitionProfile.findUnique({
      where: { id: competitionId },
      select: { isPartner: true },
    });
    if (!competition?.isPartner && await prisma.judgeAssignment.findFirst({
      where: { competitionId, status: "APPROVED", judge: { userId: account.id } },
      select: { id: true },
    })) {
      return { error: "Judges cannot admin a non-partner competition they score." };
    }
    await prisma.competitionMembership.upsert({
      where: {
        userId_competitionId: { userId: account.id, competitionId },
      },
      create: {
        userId: account.id,
        competitionId,
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
    await prisma.compInvite.deleteMany({ where: { competitionId, email } });
    revalidateAccessPaths();
    return {
      ok: true,
      message: `Request sent to ${email}. They’ll see it the next time they log in.`,
    };
  }

  await prisma.compInvite.upsert({
    where: { competitionId_email: { competitionId, email } },
    create: { competitionId, email },
    update: {},
  });
  revalidateAccessPaths();
  return {
    ok: true,
    message: `Request sent to ${email}. After they create an account, they’ll be asked to approve it.`,
  };
}

export async function inviteJudge(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = z
    .object({
      competitionId: z.string().min(1),
      email: z.string().email("Enter a valid email."),
    })
    .safeParse({
      competitionId: String(formData.get("competitionId") ?? ""),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const { competitionId, email } = parsed.data;
  const membership = await prisma.competitionMembership.findUnique({
    where: { userId_competitionId: { userId: user.id, competitionId } },
  });
  if (
    membership?.status !== "APPROVED" ||
    !membership.isAdmin
  ) {
    if (!(await isPlatformAdmin(user.id))) {
      return { error: "Only competition admins can invite judges." };
    }
  }

  const account = await prisma.user.findUnique({
    where: { email },
    include: { judge: { include: { assignments: true } } },
  });
  if (account?.judge?.assignments.some((a) => a.competitionId === competitionId && a.status === "APPROVED")) {
    return { error: "That email is already an approved judge for this competition." };
  }
  if (account?.judge?.assignments.some((a) => a.competitionId === competitionId && a.status === "REMOVED")) {
    return { error: "That judge was removed from this competition and cannot be re-invited." };
  }
  const [moderatorAccess, moderatorInvite] = await Promise.all([
    account
      ? hasModeratorAccess(account.id, competitionId)
      : Promise.resolve(false),
    prisma.moderatorInvite.findUnique({
      where: { competitionId_email: { competitionId, email } },
      select: { id: true },
    }),
  ]);
  if (moderatorAccess || moderatorInvite) {
    return {
      error: "That email is assigned as moderator for this competition, so it can see the videos and cannot judge.",
    };
  }

  const invited = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${competitionId} FOR UPDATE`;
    const competition = await tx.competitionProfile.findUnique({ where: { id: competitionId }, select: { resultsReleasedAt: true } });
    if (!competition || competition.resultsReleasedAt) return false;
    await tx.judgeInvite.upsert({
      where: { competitionId_email: { competitionId, email } },
      create: { competitionId, email },
      update: {},
    });
    return true;
  });
  if (!invited) return { error: "Judges cannot be invited after results release." };
  revalidateAccessPaths();
  return {
    ok: true,
    message: `Request sent to ${email}.`,
  };
}

export async function revokeTeamAccess(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const membershipId = String(formData.get("membershipId") ?? "");
  const replacementId = String(formData.get("replacementMembershipId") ?? "");
  const membership = await prisma.teamMembership.findUnique({
    where: { id: membershipId },
  });
  if (!membership) return { error: "Membership not found." };
  const ops = await isPlatformAdmin(user.id);
  if (!ops && !(await isTeamPrimary(user.id, membership.teamId))) {
    return { error: "Only the primary admin can remove access." };
  }
  if (membership.isPrimary && !ops) {
    return { error: "Only circuit ops can remove the primary admin." };
  }

  const newClaimCode = membership.isPrimary ? await uniqueTeamClaimCode() : null;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TeamProfile" WHERE id = ${membership.teamId} FOR UPDATE`;
    const current = await tx.teamMembership.findUnique({ where: { id: membershipId } });
    if (!current || current.teamId !== membership.teamId) {
      return { error: "Membership not found." };
    }
    if (!ops) {
      const actor = await tx.teamMembership.findUnique({
        where: { userId_teamId: { userId: user.id, teamId: current.teamId } },
      });
      if (actor?.status !== "APPROVED" || !actor.isPrimary) {
        return { error: "Only the primary admin can remove access." };
      }
    }
    if (!current.isPrimary) {
      await tx.teamMembership.delete({ where: { id: current.id } });
      return { ok: true, message: "Admin access removed." };
    }
    if (!ops) return { error: "Only circuit ops can remove the primary admin." };

    const replacements = await tx.teamMembership.findMany({
      where: { teamId: current.teamId, id: { not: current.id }, status: "APPROVED", isAdmin: true },
    });
    if (replacements.length && replacementId !== "unclaimed") {
      const replacement = replacements.find((row) => row.id === replacementId);
      if (!replacement) return { error: "Choose an approved admin as the new primary." };
      await tx.teamMembership.update({ where: { id: replacement.id }, data: { isPrimary: true } });
      await tx.teamMembership.delete({ where: { id: current.id } });
      return { ok: true, message: "Primary admin removed and replacement assigned." };
    }
    await tx.teamMembership.delete({ where: { id: current.id } });
    await tx.teamProfile.update({
      where: { id: current.teamId },
      data: { claimedAt: null, claimCode: newClaimCode ?? await uniqueTeamClaimCode() },
    });
    return { ok: true, message: "Primary admin removed. The team is unclaimed with a new claim code." };
  });
  if (result.error) return result;
  revalidateAccessPaths();
  return result;
}

export async function revokeCompAccess(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const membershipId = String(formData.get("membershipId") ?? "");
  const replacementId = String(formData.get("replacementMembershipId") ?? "");
  const membership = await prisma.competitionMembership.findUnique({
    where: { id: membershipId },
  });
  if (!membership) return { error: "Membership not found." };
  const ops = await isPlatformAdmin(user.id);
  if (!ops && !(await isCompPrimary(user.id, membership.competitionId))) {
    return { error: "Only the primary admin can remove access." };
  }
  if (membership.isPrimary && !ops) {
    return { error: "Only circuit ops can remove the primary admin." };
  }

  const newClaimCode = membership.isPrimary ? await uniqueCompClaimCode() : null;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CompetitionProfile" WHERE id = ${membership.competitionId} FOR UPDATE`;
    const current = await tx.competitionMembership.findUnique({ where: { id: membershipId } });
    if (!current || current.competitionId !== membership.competitionId) {
      return { error: "Membership not found." };
    }
    if (!ops) {
      const actor = await tx.competitionMembership.findUnique({
        where: { userId_competitionId: { userId: user.id, competitionId: current.competitionId } },
      });
      if (actor?.status !== "APPROVED" || !actor.isPrimary) {
        return { error: "Only the primary admin can remove access." };
      }
    }
    if (!current.isPrimary) {
      await tx.competitionMembership.delete({ where: { id: current.id } });
      return { ok: true, message: "Admin access removed." };
    }
    if (!ops) return { error: "Only circuit ops can remove the primary admin." };

    const replacements = await tx.competitionMembership.findMany({
      where: { competitionId: current.competitionId, id: { not: current.id }, status: "APPROVED", isAdmin: true },
    });
    if (replacements.length && replacementId !== "unclaimed") {
      const replacement = replacements.find((row) => row.id === replacementId);
      if (!replacement) return { error: "Choose an approved admin as the new primary." };
      const otherListing = await tx.competitionProfile.findFirst({
        where: { userId: replacement.userId, id: { not: current.competitionId } },
        select: { id: true },
      });
      if (otherListing) return { error: "That admin is already primary for another competition." };
      await tx.competitionProfile.update({
        where: { id: current.competitionId },
        data: { userId: replacement.userId },
      });
      await tx.competitionMembership.update({ where: { id: replacement.id }, data: { isPrimary: true } });
      await tx.competitionMembership.delete({ where: { id: current.id } });
      return { ok: true, message: "Primary admin removed and replacement assigned." };
    }
    await tx.competitionMembership.delete({ where: { id: current.id } });
    await tx.competitionProfile.update({
      where: { id: current.competitionId },
      data: {
        userId: null,
        claimedAt: null,
        claimCode: newClaimCode ?? await uniqueCompClaimCode(),
        judgingOpen: false,
        livePosition: null,
        liveUpdatedAt: null,
      },
    });
    return { ok: true, message: "Primary admin removed. The competition is unclaimed with a new claim code." };
  });
  if (result.error) return result;
  revalidateAccessPaths();
  return result;
}

export async function cancelTeamInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const inviteId = String(formData.get("inviteId") ?? "");
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { error: "Invite not found." };
  if (!(await isTeamPrimary(user.id, invite.teamId))) {
    return { error: "Only the primary admin can cancel invites." };
  }
  await prisma.teamInvite.delete({ where: { id: invite.id } });
  revalidateAccessPaths();
  return { ok: true };
}

export async function cancelCompInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  const inviteId = String(formData.get("inviteId") ?? "");
  const invite = await prisma.compInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { error: "Invite not found." };
  if (!(await isCompPrimary(user.id, invite.competitionId))) {
    return { error: "Only the primary admin can cancel invites." };
  }
  await prisma.compInvite.delete({ where: { id: invite.id } });
  revalidateAccessPaths();
  return { ok: true };
}

export async function createTeam(
  _prev:
    | { error?: string; ok?: boolean; message?: string; claimCode?: string; teamId?: string }
    | undefined,
  formData: FormData,
): Promise<{
  error?: string;
  ok?: boolean;
  message?: string;
  claimCode?: string;
  teamId?: string;
}> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can create teams." };
  }

  const parsed = z
    .object({ name: z.string().min(2, "Team name is required.") })
    .safeParse({ name: String(formData.get("name") ?? "").trim() });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const slug = await uniqueTeamSlug(parsed.data.name);
  const claimCode = await uniqueTeamClaimCode();
  const team = await prisma.teamProfile.create({
    data: { name: parsed.data.name, slug, claimCode },
  });

  revalidateAccessPaths();
  return {
    ok: true,
    claimCode: team.claimCode,
    teamId: team.id,
    message: `Created ${team.name}.`,
  };
}

export async function createCompetition(
  _prev:
    | {
        error?: string;
        ok?: boolean;
        message?: string;
        claimCode?: string;
        competitionId?: string;
      }
    | undefined,
  formData: FormData,
): Promise<{
  error?: string;
  ok?: boolean;
  message?: string;
  claimCode?: string;
  competitionId?: string;
}> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can create competitions." };
  }

  const parsed = z
    .object({
      name: z.string().min(2, "Competition name is required."),
      type: z.enum(["partner", "non-partner"]),
    })
    .safeParse({
      name: String(formData.get("name") ?? "").trim(),
      type: String(formData.get("type") ?? "partner"),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const slug = await uniqueCompSlug(parsed.data.name);
  const claimCode = await uniqueCompClaimCode();
  const competition = await prisma.competitionProfile.create({
    data: {
      name: parsed.data.name,
      isPartner: parsed.data.type === "partner",
      slug,
      claimCode,
      description: `${parsed.data.name}. Claim this listing with the official claim code after you log in.`,
    },
  });

  revalidateAccessPaths();
  revalidatePath("/");
  revalidatePath("/comps", "layout");
  return {
    ok: true,
    claimCode: competition.claimCode,
    competitionId: competition.id,
    message: `Created ${competition.name}.`,
  };
}

export async function setCompetitionPartnerStatus(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can change competition types." };
  }

  const parsed = z.object({
    competitionId: z.string().min(1),
    type: z.enum(["partner", "non-partner"]),
  }).safeParse({
    competitionId: String(formData.get("competitionId") ?? ""),
    type: String(formData.get("type") ?? ""),
  });
  if (!parsed.success) return { error: "Choose a valid competition type." };

  if (parsed.data.type === "non-partner") {
    const competition = await prisma.competitionProfile.findUnique({
      where: { id: parsed.data.competitionId },
      select: {
        userId: true,
        memberships: { where: { status: "APPROVED", isAdmin: true }, select: { userId: true } },
        judgeAssignments: { where: { status: "APPROVED" }, select: { judge: { select: { userId: true } } } },
      },
    });
    if (!competition) return { error: "Competition not found." };
    const admins = new Set([
      ...(competition.userId ? [competition.userId] : []),
      ...competition.memberships.map((membership) => membership.userId),
    ]);
    if (competition.judgeAssignments.some((assignment) => admins.has(assignment.judge.userId))) {
      return { error: "An approved competition admin is also a judge. Resolve that role conflict before switching to Non-partner." };
    }
  }

  const updated = await prisma.competitionProfile.updateMany({
    where: { id: parsed.data.competitionId },
    data: { isPartner: parsed.data.type === "partner" },
  });
  if (!updated.count) return { error: "Competition not found." };

  revalidateAccessPaths();
  revalidatePath("/");
  revalidatePath(`/comps/${parsed.data.competitionId}`);
  return { ok: true, message: "Competition type saved." };
}

export async function resetTeamClaim(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can reset a team claim." };
  }
  const teamId = String(formData.get("teamId") ?? "");
  const team = await prisma.teamProfile.findUnique({ where: { id: teamId } });
  if (!team) return { error: "Team not found." };

  const claimCode = await uniqueTeamClaimCode();
  await prisma.$transaction([
    prisma.teamMembership.deleteMany({ where: { teamId } }),
    prisma.teamInvite.deleteMany({ where: { teamId } }),
    prisma.teamProfile.update({
      where: { id: teamId },
      data: { claimedAt: null, claimCode },
    }),
  ]);
  revalidateAccessPaths();
  return {
    ok: true,
    message: `${team.name} is unclaimed again. New claim code: ${claimCode}.`,
  };
}

export async function setTeamApplyBlock(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can block a team from applying." };
  }
  const teamId = String(formData.get("teamId") ?? "");
  const blocked = String(formData.get("blocked") ?? "") === "1";
  const reason = String(formData.get("reason") ?? "").trim();
  if (blocked && !reason) {
    return { error: "Explain why this team is blocked before saving." };
  }
  if (reason.length > 500) {
    return { error: "Block reason must be 500 characters or less." };
  }
  const team = await prisma.teamProfile.findUnique({ where: { id: teamId } });
  if (!team) return { error: "Team not found." };

  await prisma.teamProfile.update({
    where: { id: teamId },
    data: { applyBlocked: blocked, applyBlockReason: blocked ? reason : "" },
  });
  revalidateAccessPaths();
  revalidatePath("/ops/teams", "layout");
  revalidatePath("/comps", "layout");
  return {
    ok: true,
    message: blocked
      ? `${team.name} cannot apply until you unblock them. Reason saved for circuit ops.`
      : `${team.name} can apply again.`,
  };
}

export async function resetCompClaim(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can reset a competition claim." };
  }
  const competitionId = String(formData.get("competitionId") ?? "");
  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
  });
  if (!competition) return { error: "Competition not found." };

  const claimCode = await uniqueCompClaimCode();
  await prisma.$transaction([
    prisma.competitionMembership.deleteMany({ where: { competitionId } }),
    prisma.compInvite.deleteMany({ where: { competitionId } }),
    prisma.judgeInvite.deleteMany({ where: { competitionId } }),
    prisma.moderatorAccess.deleteMany({ where: { competitionId } }),
    prisma.moderatorInvite.deleteMany({ where: { competitionId } }),
    ...(competition.resultsReleasedAt
      ? []
      : [prisma.judgeAssignment.deleteMany({ where: { competitionId } })]),
    prisma.competitionProfile.update({
      where: { id: competitionId },
      data: {
        claimedAt: null,
        claimCode,
        userId: null,
        judgingOpen: false,
        livePosition: null,
        liveUpdatedAt: null,
      },
    }),
  ]);
  revalidateAccessPaths();
  return {
    ok: true,
    message: `${competition.name} is unclaimed again. New claim code: ${claimCode}.`,
  };
}
