"use server";

/**
 * Sign-in, sign-out, and account settings.
 *
 * Password login only works for emails in the legacy allowlist
 * (`src/lib/auth-policy.ts`); everyone else uses Google. `googleSignInAction`
 * records whether the user pressed Google on Log In or Register so the
 * `signIn` callback in `src/auth.ts` can refuse to create accounts from Log In.
 * `requireUser` is the session check every other action starts with.
 */
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { passwordMeetsRules, passwordRuleMessage } from "@/lib/password";
import { dashboardPath } from "@/lib/roles";
import {
  AUTH_INTENT_COOKIE,
  isLegacyTestLogin,
  parseAuthIntent,
} from "@/lib/auth-policy";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerAction(
  _prev: { error?: string } | undefined,
  _formData: FormData,
): Promise<{ error?: string }> {
  void _prev;
  void _formData;
  return { error: "New accounts use Google sign-in." };
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
  if (!isLegacyTestLogin(parsed.data.email)) {
    return { error: "Use Google to sign in. Password login is only for existing test accounts." };
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

export async function googleSignInAction(formData: FormData) {
  const intent = parseAuthIntent(formData.get("intent"));
  (await cookies()).set(AUTH_INTENT_COOKIE, intent, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
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
  const previous = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!previous) {
    return { error: "Account not found." };
  }
  if (email !== previous.email) {
    return { error: "Login email cannot be changed here. Sign in with your Google account email." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

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
    select: { email: true, passwordHash: true },
  });
  if (!user) {
    return { error: "Account not found." };
  }
  if (!isLegacyTestLogin(user.email)) {
    return { error: "Password changes are only available for existing test accounts." };
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
