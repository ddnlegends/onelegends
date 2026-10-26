import { createHash } from "node:crypto";
import { submittedApplicationAvUrl } from "@/lib/application-av";

type RegAvApplication = {
  id: string;
  submittedAvDriveUrl: string | null;
  team: { avDriveUrl: string };
};

/** A review becomes stale if the application set or any submitted AV link changes. */
export function regAvFingerprint(applications: RegAvApplication[]): string {
  const rows = applications
    .map((application) => [application.id, submittedApplicationAvUrl(application).trim()] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

export function regAvReviewStatus(
  assignment: { avReviewedAt: Date | null; avReviewFingerprint: string | null } | null,
  applications: RegAvApplication[],
): "none" | "current" | "stale" {
  if (!assignment?.avReviewedAt) return "none";
  return assignment.avReviewFingerprint === regAvFingerprint(applications) ? "current" : "stale";
}
