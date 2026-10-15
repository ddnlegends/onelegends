import { test } from "./helpers";
import { expect } from "@playwright/test";
import { db, E2E, login, password } from "./helpers";

test("a test account signs in with its password", async ({ page }) => {
  await login(page, "team");
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Team Profile" }),
  ).toBeVisible();
});

test("a team and competition admin can reach both roles from a compact navigation", async ({ page }) => {
  const [user, team] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: E2E.emails.comp } }),
    db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } }),
  ]);
  await db.teamMembership.create({ data: { userId: user.id, teamId: team.id, status: "APPROVED", isAdmin: true, decidedAt: new Date() } });
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, "comp");

  const nav = page.getByRole("navigation");
  const menu = nav.locator("summary").filter({ hasText: "Team & Comp" });
  await expect(menu).toBeVisible();
  const dashboard = await nav.getByRole("link", { name: "Dashboard" }).boundingBox();
  const signOut = await nav.getByRole("button", { name: "Sign Out" }).boundingBox();
  expect(dashboard).not.toBeNull();
  expect(signOut).not.toBeNull();
  expect(Math.abs(dashboard!.y - signOut!.y)).toBeLessThan(12);

  await menu.click();
  for (const name of ["Team Profile", "Comp Details", "All Competitions", "Code Claim"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await nav.getByRole("link", { name: "All Competitions" }).click();
  await expect(page).toHaveURL(/\/comp\/competitions$/);
  await expect(nav.getByRole("link", { name: "All Competitions" })).toBeHidden();
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

test("landing overview presents the season and every role without operational details", async ({ page }) => {
  await page.goto("/");
  const overview = page.getByRole("region", { name: "How it works" });
  await expect(overview.getByRole("heading", { name: "Build one team profile" })).toBeVisible();
  await expect(overview.getByRole("heading", { name: "Watch and judge together" })).toBeVisible();
  for (const role of ["teams", "competition hosts", "judges", "moderators", "Legends staff"]) {
    await expect(overview.getByRole("heading", { name: `For ${role}` })).toBeVisible();
  }
  await expect(overview).not.toContainText("claim code");
  await expect(overview).not.toContainText("admin email");
});
