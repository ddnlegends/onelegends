import type { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    platformAdmin?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      platformAdmin: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authProvider?: string;
    id: string;
    role: Role;
    platformAdmin?: boolean;
  }
}
