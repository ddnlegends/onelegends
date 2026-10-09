import { test } from "./helpers";
import { expect } from "@playwright/test";
import { E2E, login, password } from "./helpers";

test("a test account signs in with its password", async ({ page }) => {
  await login(page, "team");
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Team Profile" }),
  ).toBeVisible();
});

for (const [label, role] of [
  ["Moderator", "moderator"],
  ["Judge", "judge"],
  ["Competition admin", "comp"],
  ["Legends admin", "tech"],
] as const) {
  test(`${label} shortcut selects its test account and signs in`, async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Existing test account login").click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("#test-email")).toHaveValue(E2E.emails[role]);
    await page.locator("#test-password").fill(password());
    await page.getByRole("button", { name: "Sign in to test account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
}

test("password login refuses emails outside the test allowlist", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Existing test account login").click();
  await page.locator("#test-email").fill("someone-new@example.org");
  await page.locator("#test-password").fill(password());
  await page.getByRole("button", { name: "Sign in to test account" }).click();
  await expect(page.getByText(/Use Google to sign in/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByText("Existing test account login").click();
  await page.locator("#test-email").fill(E2E.emails.team);
  await page.locator("#test-password").fill(`${password()}-wrong`);
  await page.getByRole("button", { name: "Sign in to test account" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
});

test("Register displays the unknown-account notice (no OAuth round trip)", async ({ page }) => {
  // The Google round trip cannot run in CI; this checks where the signIn callback sends it.
  await page.goto("/register?error=no-account");
  await expect(page.getByText(/no OneLegends account for that Google email/)).toBeVisible();
});

test("landing guide explains moderator viewing and current judge flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Moderators" }).click();
  await expect(page.getByRole("heading", { name: "How moderators run viewing" })).toBeVisible();
  await expect(page.getByText(/Moving ahead waits until every approved judge/)).toBeVisible();
  await page.getByRole("tab", { name: "Judges" }).click();
  await expect(page.getByText(/plays audition videos on a shared screen/)).toBeVisible();
  await page.getByRole("tab", { name: "Circuit ops" }).click();
  await expect(page.getByRole("heading", { name: "How circuit ops runs the season" })).toBeVisible();
});
