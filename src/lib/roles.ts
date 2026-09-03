import type { Role } from "@prisma/client";

export function dashboardPath(role: Role): string {
  switch (role) {
    case "TEAM":
      return "/team";
    case "COMP":
      return "/comp";
    case "JUDGE":
      return "/judge";
    default:
      return "/";
  }
}
