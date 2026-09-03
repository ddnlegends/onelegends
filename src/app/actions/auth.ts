"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { passwordMeetsRules, passwordRuleMessage } from "@/lib/password";
import { dashboardPath } from "@/lib/roles";
import { normalizeClaimCode } from "@/lib/claim-code";

const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email."),
    password: z.string(),
    confirmPassword: z.string(),
    name: z.string(),
    claimCode: z.string(),
    role: z.enum(["TEAM", "COMP", "JUDGE"]),
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
    if (data.role === "COMP") {
      if (normalizeClaimCode(data.claimCode).length < 4) {
        ctx.addIssue({
          code: "custom",
          path: ["claimCode"],
          message: "Enter the claim code for your competition.",
        });
      }
    } else if (data.name.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Name must be at least 2 characters.",
      });
    }
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["TEAM", "COMP", "JUDGE"]),
});

export async function registerAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    claimCode: String(formData.get("claimCode") ?? ""),
    role: String(formData.get("role") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form." };
  }

  const { email, password, name, role, claimCode } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (role === "COMP") {
    const code = normalizeClaimCode(claimCode);
    const listing = await prisma.competitionProfile.findUnique({
      where: { claimCode: code },
    });
    if (!listing) {
      return { error: "That claim code is not valid." };
    }
    if (listing.userId) {
      return {
        error: "That competition is already claimed. Ask circuit ops if you need access.",
      };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, role: "COMP" },
        });
        const claimed = await tx.competitionProfile.updateMany({
          where: { id: listing.id, userId: null },
          data: { userId: user.id, claimedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new Error("CLAIM_TAKEN");
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === "CLAIM_TAKEN") {
        return {
          error: "That competition was just claimed. Try a different code.",
        };
      }
      throw error;
    }
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role as Role,
        ...(role === "TEAM"
          ? { team: { create: { name } } }
          : { judge: { create: { name } } }),
      },
    });
  }

  try {
    await signIn("credentials", {
      email,
      password,
      role,
      redirectTo: dashboardPath(role),
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
    role: String(formData.get("role") ?? ""),
  });

  if (!parsed.success) {
    return { error: "Enter email, password, and account type." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role,
      redirectTo: dashboardPath(parsed.data.role),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Wrong email, password, or account type.",
      };
    }
    throw error;
  }

  return {};
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function requireUser(role?: Role) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  if (role && session.user.role !== role) {
    return null;
  }
  return session.user;
}
