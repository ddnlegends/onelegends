import type { Role } from "@prisma/client";

export function dashboardPath(_role?: Role): string {
  return "/dashboard";
}
