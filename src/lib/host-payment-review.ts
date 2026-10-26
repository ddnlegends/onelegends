import { createHash } from "node:crypto";

type ReviewApplication = { id: string; compPaymentReceivedAt: Date | null };

/** Changes to the applicant set or a host receipt require a fresh host review. */
export function hostPaymentFingerprint(applications: ReviewApplication[]): string {
  const rows = applications
    .map((application) => [application.id, Boolean(application.compPaymentReceivedAt)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
