/** Shared fail-closed guard for destructive fixtures and local password login. */
type Environment = Record<string, string | undefined>;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isDisposableDatabase(raw: string | undefined): boolean {
  try {
    const url = new URL(raw ?? "");
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      LOCAL_HOSTS.has(url.hostname) &&
      url.pathname === "/onelegends_e2e" &&
      // libpq-style host overrides must not bypass the hostname check.
      [...url.searchParams.keys()].every((key) =>
        ["schema", "connection_limit", "pool_timeout", "sslmode"].includes(key),
      )
    );
  } catch {
    return false;
  }
}

export function assertDisposableDatabase(env: Environment = process.env): void {
  if (
    env.VERCEL || env.VERCEL_ENV ||
    env.ALLOW_TEST_DATABASE_RESET !== "1" ||
    !isDisposableDatabase(env.DATABASE_URL) ||
    !isDisposableDatabase(env.DIRECT_URL)
  ) {
    throw new Error(
      "Refusing destructive fixtures: set ALLOW_TEST_DATABASE_RESET=1 and point BOTH database URLs at a loopback database named onelegends_e2e, outside Vercel.",
    );
  }
}

export function testPasswordLoginEnabled(env: Environment = process.env): boolean {
  if (env.AUTH_ENABLE_TEST_LOGIN !== "true" || env.VERCEL || env.VERCEL_ENV) return false;
  if (!isDisposableDatabase(env.DATABASE_URL) || !isDisposableDatabase(env.DIRECT_URL)) return false;
  try {
    const url = new URL(env.AUTH_URL ?? "");
    return ["http:", "https:"].includes(url.protocol) && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
