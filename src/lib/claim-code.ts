export function normalizeClaimCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
