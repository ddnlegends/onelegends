/**
 * Claim codes (`TEAM-XXXXXX`, `COMP-XXXXXX`) hand a listing to its first admin.
 * Server-only: codes come from `node:crypto` so they cannot be guessed, and the
 * alphabet skips look-alike characters (0/O, 1/I).
 */
import { randomInt } from "node:crypto";

export function normalizeClaimCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePrefixedClaimCode(prefix: string): string {
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return `${prefix}-${suffix}`;
}

export function generateTeamClaimCode(): string {
  return generatePrefixedClaimCode("TEAM");
}

export function generateCompClaimCode(): string {
  return generatePrefixedClaimCode("COMP");
}

export function blurEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}
