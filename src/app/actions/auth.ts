"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { passwordMeetsRules, passwordRuleMessage } from "@/lib/password";
import { dashboardPath } from "@/lib/roles";
import { hydrateEmailInvites } from "@/lib/invites";

const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email."),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!passwordMeetsRules(data.password)) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: passwordRuleMessage(),
      });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords must match.",
      });
    }
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const { email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { email, passwordHash, role: "TEAM" },
  });
  try {
    await hydrateEmailInvites(created.id, created.email);
  } catch {
    /* Invites can wait until the next Account load. */
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: dashboardPath(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try logging in." };
    }
    throw error;
  }

  return {};
}

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Enter email and password." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: dashboardPath(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Wrong email or password." };
    }
    throw error;
  }

  return {};
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: dashboardPath() });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

const profileSchema = z.object({
  name: z.string().trim().max(80, "Name is too long."),
  email: z.string().email("Enter a valid email."),
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!passwordMeetsRules(data.password)) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: passwordRuleMessage(),
      });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords must match.",
      });
    }
  });

function revalidateProfile() {
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function updateProfileAction(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in to update your profile." };
  }

  const parsed = profileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const { name, email } = parsed.data;
  const taken = await prisma.user.findFirst({
    where: { email, NOT: { id: session.user.id } },
    select: { id: true },
  });
  if (taken) {
    return { error: "An account with that email already exists." };
  }

  const previous = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!previous) {
    return { error: "Account not found." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email },
  });

  if (email !== previous.email) {
    try {
      await hydrateEmailInvites(session.user.id, email);
    } catch {
      /* Invites can wait until the next dashboard load. */
    }
  }

  revalidateProfile();
  return { ok: true, message: "Changes saved." };
}

export async function changePasswordAction(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sign in to change your password." };
  }

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    return { error: "Account not found." };
  }
  if (!user.passwordHash) {
    return { error: "This login uses Google. There is no password to change." };
  }

  const matches = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash,
  );
  if (!matches) {
    return { error: "Current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  });

  revalidateProfile();
  return { ok: true, message: "Password updated." };
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return session.user;
}
