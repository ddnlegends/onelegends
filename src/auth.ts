import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["TEAM", "COMP", "JUDGE"];

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
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const role = String(credentials?.role ?? "") as Role;

        if (!email || !password || !ROLES.includes(role)) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== role) return null;

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        return token;
      }
      if (!token.id) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: String(token.id) },
        select: { id: true, role: true },
      });
      if (!dbUser) return null;

      token.role = dbUser.role;
      return token;
    },
    session({ session, token }) {
      if (!token.id) {
        return session;
      }
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
