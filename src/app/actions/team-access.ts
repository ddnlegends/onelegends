"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { blurEmail, normalizeClaimCode } from "@/lib/claim-code";
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
        where: { id: team.id, claimedAt: null },
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

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.competitionProfile.updateMany({
        where: { id: listing.id, userId: null, claimedAt: null },
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
  });
  if (!membership) return { error: "That competition request was not found." };

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

  const name = dbUser.name.trim() || dbUser.email.split("@")[0] || "Judge";

  const judge = await prisma.judgeProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, name },
    update: {},
  });

  await prisma.judgeAssignment.upsert({
    where: {
      judgeId_competitionId: {
        judgeId: judge.id,
        competitionId: invite.competitionId,
      },
    },
    create: {
      judgeId: judge.id,
      competitionId: invite.competitionId,
      status: "APPROVED",
      decidedAt: new Date(),
    },
    update: {
      status: "APPROVED",
      decidedAt: new Date(),
      submittedAt: null,
    },
  });
  await prisma.judgeInvite.delete({ where: { id: invite.id } });
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

  await prisma.judgeInvite.upsert({
    where: { competitionId_email: { competitionId, email } },
    create: { competitionId, email },
    update: {},
  });
  revalidateAccessPaths();
  return {
    ok: true,
    message: `Request sent to ${email}.`,
  };
}

export async function revokeTeamAccess(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await prisma.teamMembership.findUnique({
    where: { id: membershipId },
  });
  if (!membership) return { error: "Membership not found." };
  if (!(await isTeamPrimary(user.id, membership.teamId))) {
    return { error: "Only the primary admin can remove access." };
  }
  if (membership.isPrimary) {
    return { error: "Reset the claim from Account if you need a new primary." };
  }

  await prisma.teamMembership.delete({ where: { id: membership.id } });
  revalidateAccessPaths();
  return { ok: true };
}

export async function revokeCompAccess(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };

  const membershipId = String(formData.get("membershipId") ?? "");
  const membership = await prisma.competitionMembership.findUnique({
    where: { id: membershipId },
  });
  if (!membership) return { error: "Membership not found." };
  if (!(await isCompPrimary(user.id, membership.competitionId))) {
    return { error: "Only the primary admin can remove access." };
  }
  if (membership.isPrimary) {
    return { error: "Reset the claim from Account if you need a new primary." };
  }

  await prisma.competitionMembership.delete({ where: { id: membership.id } });
  revalidateAccessPaths();
  return { ok: true };
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
    .object({ name: z.string().min(2, "Competition name is required.") })
    .safeParse({ name: String(formData.get("name") ?? "").trim() });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const slug = await uniqueCompSlug(parsed.data.name);
  const claimCode = await uniqueCompClaimCode();
  const competition = await prisma.competitionProfile.create({
    data: {
      name: parsed.data.name,
      slug,
      claimCode,
      description: `${parsed.data.name}. Claim this listing with the official bid code after you log in.`,
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

  await prisma.$transaction([
    prisma.teamMembership.deleteMany({ where: { teamId } }),
    prisma.teamInvite.deleteMany({ where: { teamId } }),
    prisma.teamProfile.update({
      where: { id: teamId },
      data: { claimedAt: null },
    }),
  ]);
  revalidateAccessPaths();
  return {
    ok: true,
    message: `${team.name} is unclaimed again. The claim code is still ${team.claimCode}.`,
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
  const team = await prisma.teamProfile.findUnique({ where: { id: teamId } });
  if (!team) return { error: "Team not found." };

  await prisma.teamProfile.update({
    where: { id: teamId },
    data: { applyBlocked: blocked },
  });
  revalidateAccessPaths();
  revalidatePath("/comps", "layout");
  return {
    ok: true,
    message: blocked
      ? `${team.name} cannot apply until you unblock them.`
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

  await prisma.$transaction([
    prisma.competitionMembership.deleteMany({ where: { competitionId } }),
    prisma.compInvite.deleteMany({ where: { competitionId } }),
    prisma.competitionProfile.update({
      where: { id: competitionId },
      data: { claimedAt: null, userId: null },
    }),
  ]);
  revalidateAccessPaths();
  return {
    ok: true,
    message: `${competition.name} is unclaimed again. The claim code is still ${competition.claimCode}.`,
  };
}
