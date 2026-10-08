/** Account allowlist for local fixtures only; the environment guard is enforced separately. */
const LEGACY_TEST_EMAILS = new Set([
  "legendstech@desidancenetwork.org",
  "legendstestadmin@gmail.com",
  "legendstestcomp@gmail.com",
  "legendstestuser@gmail.com",
  "legendstestreg@gmail.com", // Existing test account keeps its login.
  "legendstestmoderator@gmail.com",
]);

export function isLegacyTestLogin(email: string): boolean {
  return LEGACY_TEST_EMAILS.has(email.trim().toLowerCase());
}

/** Set before the Google redirect so the callback knows whether a new account may be created. */
export const AUTH_INTENT_COOKIE = "ol_auth_intent";

export type AuthIntent = "login" | "register";

export function parseAuthIntent(value: unknown): AuthIntent {
  return value === "register" ? "register" : "login";
}
