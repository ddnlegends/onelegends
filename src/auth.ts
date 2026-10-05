import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCachedUser } from "@/lib/cached-user";
import { isLegacyTestLogin } from "@/lib/auth-policy";
import { hydrateEmailInvites } from "@/lib/invites";
import { applyRegistrationInvites } from "@/lib/registration";
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
          await applyRegistrationInvites(user.id, user.email);
        } catch {
          /* Registration access can wait until the next dashboard load. */
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
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
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
