import { expect, test } from "@playwright/test";
import { E2E } from "../prisma/e2e-seed";

test("hosted production hides password login and rejects a direct credentials callback", async ({ page, request }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log In" })).toBeVisible();
  await expect(page.getByText("Existing test account login")).toHaveCount(0);
  const csrfResponse = await request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBe(true);
  const { csrfToken } = await csrfResponse.json();
  expect(csrfToken).toBeTruthy();
  const response = await request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email: E2E.emails.tech, password: process.env.E2E_PASSWORD!, callbackUrl: "/dashboard" },
    maxRedirects: 0,
  });
  expect([302, 303]).toContain(response.status());
  expect(response.headers().location).toContain("error=CredentialsSignin");
  expect(await (await request.get("/api/auth/session")).json()).toBeNull();
});

for (const provider of [undefined, "credentials"]) {
  test(`hosted production invalidates existing ${provider ?? "legacy"} sessions`, async ({ context, page }) => {
    const { encode } = await import("next-auth/jwt");
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      const user = await db.user.findUniqueOrThrow({ where: { email: E2E.emails.tech } });
      const token = await encode({
        token: { id: user.id, email: user.email, role: user.role, platformAdmin: true, authProvider: provider },
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
