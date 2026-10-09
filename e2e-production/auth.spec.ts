import { expect, test } from "@playwright/test";
import { E2E } from "../prisma/e2e-seed";

for (const [label, role] of [
  ["Moderator", "moderator"],
  ["Judge", "judge"],
  ["Competition admin", "comp"],
  ["Legends admin", "tech"],
] as const) {
  test(`production permits the ${label} demonstration account`, async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Existing test account login").click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("#test-email")).toHaveValue(E2E.emails[role]);
    await page.locator("#test-password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in to test account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
}

test("production refuses a password login for the team fixture", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();
  await page.getByText("Existing test account login").click();
  await page.locator("#test-email").fill(E2E.emails.team);
  await page.locator("#test-password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to test account" }).click();
  await expect(page.getByText(/Password login is only for the listed test accounts/)).toBeVisible();
  const csrfResponse = await request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBe(true);
  const { csrfToken } = await csrfResponse.json();
  expect(csrfToken).toBeTruthy();
  const response = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: E2E.emails.team, password: process.env.E2E_PASSWORD!, callbackUrl: "/dashboard" },
    maxRedirects: 0,
  });
  expect([302, 303]).toContain(response.status());
  expect(response.headers().location).toContain("error=CredentialsSignin");
  expect(await (await request.get("/api/auth/session")).json()).toBeNull();
});

test("production rejects a wrong demonstration password", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Existing test account login").click();
  await page.getByRole("button", { name: "Legends admin", exact: true }).click();
  await page.locator("#test-password").fill(`${process.env.E2E_PASSWORD!}-wrong`);
  await page.getByRole("button", { name: "Sign in to test account" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

for (const provider of [undefined, "credentials"]) {
  test(`production invalidates existing ${provider ?? "legacy"} sessions for unlisted accounts`, async ({ context, page }) => {
    const { encode } = await import("next-auth/jwt");
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      const user = await db.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
      const token = await encode({
        token: { id: user.id, email: user.email, role: user.role, platformAdmin: false, authProvider: provider },
        secret: "e2e-only-secret-not-for-production-use",
        salt: "authjs.session-token",
      });
      await context.addCookies([{ name: "authjs.session-token", value: token, url: "http://127.0.0.1:3101", httpOnly: true, sameSite: "Lax" }]);
      expect(await (await page.request.get("/api/auth/session")).json()).toBeNull();
      await page.goto("/ops/teams");
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await db.$disconnect();
    }
  });
}
