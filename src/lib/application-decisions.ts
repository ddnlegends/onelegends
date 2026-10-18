import type { ApplicationStatus } from "@prisma/client";

export function teamVisibleApplicationStatus(
  status: ApplicationStatus,
  decisionsSubmittedAt: Date | null,
): ApplicationStatus {
  return decisionsSubmittedAt ? status : "PENDING";
}
