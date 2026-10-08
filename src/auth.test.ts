import { beforeEach, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ config: undefined as unknown }));
vi.mock("next-auth", () => ({ default: (config: unknown) => { captured.config = config; return {}; } }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/cached-user", () => ({ getCachedUser: vi.fn() }));
vi.mock("@/lib/invites", () => ({ hydrateEmailInvites: vi.fn() }));
vi.mock("@/lib/moderator", () => ({ applyModeratorInvites: vi.fn() }));
vi.mock("@/lib/ops-admin", () => ({ applyPlatformAdminInvite: vi.fn(), googleAuthEnabled: () => false, upsertGoogleUser: vi.fn() }));

import "./auth";
import { prisma } from "@/lib/prisma";
import { getCachedUser } from "@/lib/cached-user";
import type { NextAuthConfig } from "next-auth";
const config = () => captured.config as NextAuthConfig;

beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

it("denies direct credentials authorization before querying production data", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("AUTH_ENABLE_TEST_LOGIN", "true");
  const provider = config().providers[0] as unknown as { options: { authorize: (credentials: Record<string, string>, request: Request) => Promise<unknown> } };
  const result = await provider.options.authorize({ email: "legendstech@desidancenetwork.org", password: "any-password" }, new Request("https://example.org"));
  expect(result).toBeNull();
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});

it.each([undefined, "credentials", "unknown"])("revokes hosted sessions with unsafe provider provenance: %s", async (authProvider) => {
  vi.stubEnv("VERCEL_ENV", "production");
  const jwt = config().callbacks!.jwt!;
  const result = await jwt({ token: { id: "old-admin", role: "TEAM", authProvider } } as unknown as Parameters<typeof jwt>[0]);
  expect(result).toBeNull();
  expect(getCachedUser).not.toHaveBeenCalled();
});

it("refreshes Google permissions from the database on subsequent requests", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.mocked(getCachedUser).mockResolvedValue({ id: "user", email: "user@example.org", name: "User", role: "TEAM", platformAdmin: false });
  const jwt = config().callbacks!.jwt!;
  const result = await jwt({ token: { id: "user", role: "TEAM", authProvider: "google", platformAdmin: true } } as unknown as Parameters<typeof jwt>[0]);
  expect(result).toMatchObject({ platformAdmin: false, authProvider: "google" });
});

async function googleSignIn(intent: string | undefined, verified: unknown = true) {
  const { cookies } = await import("next/headers");
  const jar = { get: vi.fn(() => intent ? { value: intent } : undefined), delete: vi.fn() };
  vi.mocked(cookies).mockResolvedValue(jar as unknown as Awaited<ReturnType<typeof cookies>>);
  const signIn = config().callbacks!.signIn!;
  const result = await signIn({
    user: { id: "google-subject", email: "  Person@Example.org ", name: "Person", role: "TEAM" },
    account: { provider: "google", providerAccountId: "google-subject", type: "oidc" },
    profile: verified === "missing" ? {} : { email_verified: verified },
  } as Parameters<typeof signIn>[0]);
  return { result, jar };
}

it.each([undefined, "login", "REGISTER"])("unknown Google email cannot register from intent %s", async (intent) => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  const { result, jar } = await googleSignIn(intent);
  expect(result).toBe("/register?error=no-account");
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "person@example.org" }, select: { id: true } });
  expect(jar.delete).toHaveBeenCalledWith("ol_auth_intent");
});

it("explicit registration accepts a verified Google identity", async () => {
  const { result, jar } = await googleSignIn("register");
  expect(result).toBe(true);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
  expect(jar.delete).toHaveBeenCalledWith("ol_auth_intent");
});

it("existing Google identities can log in", async () => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as Awaited<ReturnType<typeof prisma.user.findUnique>>);
  expect((await googleSignIn("login")).result).toBe(true);
});

it.each([false, "missing", "true"])("rejects an unverified or malformed Google assertion: %s", async (verified) => {
  expect((await googleSignIn("register", verified)).result).toBe(false);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});
