import { prisma } from "@/lib/prisma";

export const CLAIM_ATTEMPT_LIMIT = 20;
export const CLAIM_ATTEMPT_WINDOW_MINUTES = 15;

/**
 * One budget for both preview and claim actions, across teams and competitions.
 * PostgreSQL's conditional UPDATE serializes concurrent requests on the user
 * row. Use the database clock; denied attempts cannot extend the lockout.
 * A missing user or unavailable limiter refuses the claim without a lookup.
 */
export async function claimAttemptError(userId: string): Promise<string | null> {
  try {
    const accepted = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "User"
      SET "claimAttemptCount" = CASE
        WHEN "claimAttemptWindowStart" IS NULL
          OR "claimAttemptWindowStart" <= CURRENT_TIMESTAMP - (${CLAIM_ATTEMPT_WINDOW_MINUTES} * INTERVAL '1 minute')
        THEN 1 ELSE "claimAttemptCount" + 1 END,
        "claimAttemptWindowStart" = CASE
        WHEN "claimAttemptWindowStart" IS NULL
          OR "claimAttemptWindowStart" <= CURRENT_TIMESTAMP - (${CLAIM_ATTEMPT_WINDOW_MINUTES} * INTERVAL '1 minute')
        THEN CURRENT_TIMESTAMP ELSE "claimAttemptWindowStart" END
      WHERE id = ${userId}
        AND ("claimAttemptWindowStart" IS NULL
          OR "claimAttemptWindowStart" <= CURRENT_TIMESTAMP - (${CLAIM_ATTEMPT_WINDOW_MINUTES} * INTERVAL '1 minute')
          OR "claimAttemptCount" < ${CLAIM_ATTEMPT_LIMIT})
      RETURNING id
    `;
    return accepted.length === 1
      ? null
      : "Too many claim attempts. Wait 15 minutes before trying again.";
  } catch {
    // No codes, account information, connection URLs, or raw DB errors in logs.
    console.error("claim_rate_limit_unavailable");
    return "Claims are temporarily unavailable. Please try again later.";
  }
}
