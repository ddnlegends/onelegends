import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

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

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          platformAdmin: user.platformAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
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

      const dbUser = await prisma.user.findUnique({
        where: { id: String(token.id) },
        select: { id: true, email: true, name: true, role: true, platformAdmin: true },
      });
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
