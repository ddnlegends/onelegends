/** Existing demonstration accounts retain password sign-in during the Google transition. */
const LEGACY_TEST_EMAILS = new Set([
  "legendstech@desidancenetwork.org",
  "legendstestadmin@gmail.com",
  "legendstestcomp@gmail.com",
  "legendstestuser@gmail.com",
  "legendstestreg@gmail.com",
]);

export function isLegacyTestLogin(email: string): boolean {
  return LEGACY_TEST_EMAILS.has(email.trim().toLowerCase());
}
