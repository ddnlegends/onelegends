import { createHash } from "node:crypto";

type ReviewApplication = {
  id: string;
  compPaymentReceivedAt: Date | null;
  viewingPosition: number | null;
  team: { registrationPaidAt: Date | null; applyBlocked: boolean };
};

/** Any change to the reviewed payment or eligibility state requires a fresh review. */
export function hostPaymentFingerprint(applications: ReviewApplication[], competitionPaidAt: Date | null): string {
  const rows = applications
    .map((application) => [
      application.id,
      Boolean(application.compPaymentReceivedAt),
      Boolean(application.team.registrationPaidAt),
      application.team.applyBlocked,
      application.viewingPosition,
    ] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return createHash("sha256").update(JSON.stringify([Boolean(competitionPaidAt), rows])).digest("hex");
}
