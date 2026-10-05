/**
 * The single Prisma client. In development it is kept on `globalThis` so hot
 * reloads do not open a new connection pool each time. Production uses the
 * Supabase transaction pooler (`DATABASE_URL`, port 6543).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
