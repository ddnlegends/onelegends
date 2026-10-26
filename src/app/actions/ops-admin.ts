"use server";

/**
 * Circuit tech-admin access controls: Moderator grants and invites, and platform
 * admin invites and removal.
 *
 * Every action requires `platformAdmin`. Removing an admin takes an advisory
 * lock so the circuit can never drop to zero platform admins.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/actions/auth";
import { isPlatformAdmin } from "@/lib/team-access";

function revalidateOps() {
  revalidatePath("/dashboard");
  revalidatePath("/ops/comps", "layout");
  revalidatePath("/moderator", "layout");
  revalidatePath("/", "layout");
}

export async function grantModeratorAccess(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can grant moderator access." };
  }

  const parsed = z
    .object({
      competitionId: z.string().min(1, "Pick a competition."),
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

  const competition = await prisma.competitionProfile.findUnique({
    where: { id: competitionId },
    select: { id: true, name: true },
  });
  if (!competition) return { error: "Competition not found." };

  const account = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      platformAdmin: true,
      judge: {
        select: {
          assignments: {
            where: { competitionId, status: { not: "DENIED" } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (account?.platformAdmin) {
    return {
      error:
        "Tech admins follow judging from Comp Dashboard. Use a separate moderator account.",
    };
  }
  const judgeInvite = await prisma.judgeInvite.findUnique({
    where: { competitionId_email: { competitionId, email } },
    select: { id: true },
  });
  if (account?.judge?.assignments.length || judgeInvite) {
    return {
      error: `${email} judges ${competition.name}. Judges cannot see the videos.`,
    };
  }

  if (account) {
    const existing = await prisma.moderatorAccess.findUnique({
      where: { userId_competitionId: { userId: account.id, competitionId } },
      select: { id: true },
    });
    if (existing) {
      return { error: `${email} is already a moderator for ${competition.name}.` };
    }
    await prisma.moderatorAccess.create({
      data: { userId: account.id, competitionId },
    });
    await prisma.moderatorInvite.deleteMany({ where: { competitionId, email } });
    revalidateOps();
    return {
      ok: true,
      message: `${email} can run live viewing for ${competition.name}.`,
    };
  }

  await prisma.moderatorInvite.upsert({
    where: { competitionId_email: { competitionId, email } },
    create: { competitionId, email },
    update: {},
  });
  revalidateOps();
  return {
    ok: true,
    message: `${email} gets moderator access for ${competition.name} as soon as they log in or register.`,
  };
}

export async function removeModeratorAccess(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can remove moderator access." };
  }
  const accessId = String(formData.get("accessId") ?? "");
  const row = await prisma.moderatorAccess.findUnique({
    where: { id: accessId },
    select: { id: true },
  });
  if (!row) return { error: "Moderator access not found." };
  await prisma.moderatorAccess.delete({ where: { id: row.id } });
  revalidateOps();
  return { ok: true };
}

export async function cancelModeratorInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can cancel moderator invites." };
  }
  const inviteId = String(formData.get("inviteId") ?? "");
  const invite = await prisma.moderatorInvite.findUnique({
    where: { id: inviteId },
    select: { id: true },
  });
  if (!invite) return { error: "Invite not found." };
  await prisma.moderatorInvite.delete({ where: { id: invite.id } });
  revalidateOps();
  return { ok: true };
}

export async function invitePlatformAdmin(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can invite tech admins." };
  }

  const parsed = z
    .object({ email: z.string().email("Enter a valid email.") })
    .safeParse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const { email } = parsed.data;
  if (email === user.email?.trim().toLowerCase()) {
    return { error: "You already have tech admin access." };
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, platformAdmin: true },
  });
  if (existing?.platformAdmin) {
    return { error: "That email is already a tech admin." };
  }
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { platformAdmin: true },
    });
    await prisma.platformAdminInvite.deleteMany({ where: { email } });
    revalidateOps();
    return {
      ok: true,
      message: `${email} is a tech admin now. They’ll see circuit ops the next time they load the app.`,
    };
  }

  await prisma.platformAdminInvite.upsert({
    where: { email },
    create: { email },
    update: {},
  });
  revalidateOps();
  return {
    ok: true,
    message: `${email} will be a tech admin as soon as they log in or register.`,
  };
}

export async function cancelPlatformAdminInvite(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can cancel tech admin invites." };
  }
  const inviteId = String(formData.get("inviteId") ?? "");
  const invite = await prisma.platformAdminInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite) return { error: "Invite not found." };
  await prisma.platformAdminInvite.delete({ where: { id: invite.id } });
  revalidateOps();
  return { ok: true };
}

export async function revokePlatformAdmin(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const user = await requireUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await isPlatformAdmin(user.id))) {
    return { error: "Only circuit ops can remove tech admins." };
  }
  const userId = String(formData.get("userId") ?? "");
  if (userId === user.id) {
    return { error: "You cannot remove your own tech admin access." };
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('platform-admins'))`;
    const remaining = await tx.user.count({ where: { platformAdmin: true } });
    if (remaining <= 1) return { error: "Keep at least one tech admin." };
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, platformAdmin: true, email: true },
    });
    if (!target?.platformAdmin) return { error: "That account is not a tech admin." };
    await tx.user.update({
      where: { id: target.id },
      data: { platformAdmin: false },
    });
    return { email: target.email };
  });
  if ("error" in result) return { error: result.error };
  revalidateOps();
  return { ok: true, message: `Removed tech admin access for ${result.email}.` };
}
