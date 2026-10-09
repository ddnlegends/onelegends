/** Temporary production demonstration accounts. Keep these distinct from staff accounts. */
export const PUBLIC_TEST_ACCOUNTS = [
  { label: "Moderator", email: "legendstestmoderator@gmail.com" },
  { label: "Judge", email: "legendstestuser@gmail.com" },
  { label: "Competition admin", email: "legendstestcomp@gmail.com" },
  { label: "Legends admin", email: "legendstestadmin@gmail.com" },
] as const;

const PUBLIC_TEST_EMAILS = new Set<string>(PUBLIC_TEST_ACCOUNTS.map((account) => account.email));

export function isPublicTestLogin(email: string): boolean {
  return PUBLIC_TEST_EMAILS.has(email.trim().toLowerCase());
}

/** Additional accounts used by disposable local fixtures only. */
const LEGACY_TEST_EMAILS = new Set([
  "legendstech@desidancenetwork.org",
  "legendstestuser@gmail.com",
  "legendstestreg@gmail.com", // Existing test account keeps its login.
  ...PUBLIC_TEST_EMAILS,
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
