/**
 * Auth.js configuration (JWT sessions; separate from Supabase Auth).
 *
 * Google is the normal sign-in. Password sign-in exists only for the legacy
 * test emails in `src/lib/auth-policy.ts`, only against opted-in local fixtures.
 * The `signIn` callback creates new Google users only when the intent cookie says Register; from Log In an
 * unknown email is sent to `/register?error=no-account`. The session carries
 * `id`, `role`, and `platformAdmin`, kept in sync with the user row.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { testPasswordLoginEnabled } from "@/lib/test-environment";
import { getCachedUser } from "@/lib/cached-user";
import {
  AUTH_INTENT_COOKIE,
  isLegacyTestLogin,
  parseAuthIntent,
} from "@/lib/auth-policy";
import { hydrateEmailInvites } from "@/lib/invites";
import { applyModeratorInvites } from "@/lib/moderator";
import {
  applyPlatformAdminInvite,
  googleAuthEnabled,
  upsertGoogleUser,
} from "@/lib/ops-admin";
import type { Role } from "@prisma/client";

const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!testPasswordLoginEnabled()) return null;
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password || !isLegacyTestLogin(email)) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;

        await applyPlatformAdminInvite(user.id, user.email);
        try {
          await applyModeratorInvites(user.id, user.email);
        } catch {
          /* Moderator access can wait until the next dashboard load. */
        }

        const fresh = await prisma.user.findUnique({ where: { id: user.id } });
        if (!fresh) return null;

        return {
          id: fresh.id,
          email: fresh.email,
          name: fresh.name,
          role: fresh.role,
          platformAdmin: fresh.platformAdmin,
        };
      },
    }),
    ...(googleAuthEnabled() && googleId && googleSecret
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
            allowDangerousEmailAccountLinking: true,
            // Shared/club devices: without this Google silently reuses the
            // browser's signed-in account, so you can't switch accounts.
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      if (profile?.email_verified !== true) return false;
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;

      const cookieStore = await cookies();
      const intent = parseAuthIntent(cookieStore.get(AUTH_INTENT_COOKIE)?.value);
      cookieStore.delete(AUTH_INTENT_COOKIE);
      if (intent === "register") return true;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      return existing ? true : "/register?error=no-account";
    },
    async jwt({ token, user, account }) {
      if (account) token.authProvider = account.provider;
      // Old sessions have no provenance; require one fresh login on rollout.
      if (
        token.authProvider !== "google" &&
        !(token.authProvider === "credentials" && testPasswordLoginEnabled())
      ) return null;
      if (account?.provider === "google") {
        const email = user?.email?.trim().toLowerCase();
        if (!email) return null;
        const dbUser = await upsertGoogleUser({
          email,
          name: user.name,
        });
        try {
          await hydrateEmailInvites(dbUser.id, dbUser.email);
        } catch {
          /* Invites can wait until the next dashboard load. */
        }
        const fresh = await prisma.user.findUnique({
          where: { id: dbUser.id },
        });
        if (!fresh) return null;
        token.id = fresh.id;
        token.role = fresh.role;
        token.email = fresh.email;
        token.name = fresh.name ?? "";
        token.platformAdmin = fresh.platformAdmin;
        return token;
      }

      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name ?? "";
        token.platformAdmin = Boolean(
          "platformAdmin" in user && user.platformAdmin,
        );
        return token;
      }
      if (!token.id) return token;

      const dbUser = await getCachedUser(String(token.id));
      if (!dbUser) return null;

      token.email = dbUser.email;
      token.name = dbUser.name;
      token.role = dbUser.role;
      token.platformAdmin = dbUser.platformAdmin;
      return token;
    },
    session({ session, token }) {
      if (!token.id) {
        return session;
      }
      session.user.id = token.id as string;
      session.user.email = typeof token.email === "string" ? token.email : "";
      session.user.name = typeof token.name === "string" ? token.name : "";
      session.user.role = token.role as Role;
      session.user.platformAdmin = Boolean(token.platformAdmin);
      return session;
    },
  },
});
