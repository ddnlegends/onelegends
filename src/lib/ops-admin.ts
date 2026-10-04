import { prisma } from "@/lib/prisma";

export function googleAuthEnabled() {
  return Boolean(
    (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
      (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET),
  );
}

export async function applyPlatformAdminInvite(userId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  const invite = await prisma.platformAdminInvite.findUnique({
    where: { email: normalized },
  });
  if (!invite) return false;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { platformAdmin: true },
    }),
    prisma.platformAdminInvite.delete({ where: { id: invite.id } }),
  ]);
  return true;
}

export async function upsertGoogleUser(input: {
  email: string;
  name?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() ?? "";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (name && !existing.name) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    await applyPlatformAdminInvite(existing.id, email);
    return prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
  }

  const created = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: null,
      role: "TEAM",
    },
  });
  await applyPlatformAdminInvite(created.id, email);
  return prisma.user.findUniqueOrThrow({ where: { id: created.id } });
}
