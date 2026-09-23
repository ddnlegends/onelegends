import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getCachedUser = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      platformAdmin: true,
    },
  });
});
