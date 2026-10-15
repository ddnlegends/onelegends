import { test, db, E2E, login, pageAs, password } from "./helpers";
import { expect } from "@playwright/test";

test("footer feedback records the user and page, and admins can follow up", async ({ page, browser }) => {
  await login(page, "team");
  await page.goto("/team/profile?private=test");
  await page.getByRole("contentinfo").getByRole("link", { name: "Feedback", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Feedback", exact: true })).toBeVisible();
  await expect(page.getByText("Sending as E2E Team Admin")).toBeVisible();
  await expect(page.getByText("Page: /team/profile", { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/feedback-form-${test.info().project.name}.png`, fullPage: true });
  await page.getByLabel("What would you like to share?").selectOption("CONCERN");
  const message = "The team application instructions need clarification. <script>alert('not HTML')</script>";
  await page.getByLabel("Your message").fill(message);
  await page.getByRole("button", { name: "Send feedback", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Your message is saved");
  const row = await db.feedback.findFirstOrThrow({ where: { message } });
  expect(row).toMatchObject({ submitterEmail: E2E.emails.team, category: "CONCERN", pagePath: "/team/profile", status: "NEW" });
  await expect(page.getByRole("link", { name: "Back to the site" })).toHaveAttribute("href", "/team/profile");
  await page.getByRole("button", { name: "Send another message" }).click();
  await expect(page.getByLabel("Your message")).toHaveValue("");

  const admin = await pageAs(browser, "tech");
  await admin.getByRole("main").getByRole("link", { name: /Feedback inbox/ }).click();
  const card = admin.getByRole("article").filter({ hasText: message });
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: E2E.emails.team })).toBeVisible();
  await card.getByText("Account and page details").click();
  await expect(card.getByText(/Teams: E2E Crew/)).toBeVisible();
  await admin.screenshot({ path: `test-results/feedback-inbox-${test.info().project.name}.png`, fullPage: true });
  await card.getByLabel("Status", { exact: true }).selectOption("IN_PROGRESS");
  await card.getByRole("button", { name: "Save status" }).click();
  await expect(card.getByRole("status")).toContainText("Status saved.");
  await expect.poll(async () => (await db.feedback.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("IN_PROGRESS");
  await card.getByLabel("Status", { exact: true }).selectOption("RESOLVED");
  await card.getByRole("button", { name: "Save status" }).click();
  await expect.poll(async () => (await db.feedback.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("RESOLVED");
  await admin.getByLabel("Filter by status").selectOption("NEW");
  await admin.getByRole("button", { name: "Apply filter" }).click();
  await expect(admin.getByText("No feedback matches this filter.")).toBeVisible();
  await admin.getByLabel("Filter by status").selectOption("RESOLVED");
  await admin.getByRole("button", { name: "Apply filter" }).click();
  await expect(admin.getByRole("article")).toContainText(message);

  // Check streamed responses too: redirecting later must not leak the inbox.
  const denied = await page.request.get("/ops/feedback", { maxRedirects: 0 });
  expect(await denied.text()).not.toContain(message);
  await page.goto("/ops/feedback");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("signed-out users sign in before sending and return to feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Feedback", exact: true }).click();
  await expect(page.getByLabel("Your message")).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in to send feedback" }).click();
  await page.getByText("Existing test account login").click();
  await page.getByLabel("Email", { exact: true }).fill(E2E.emails.judge);
  await page.getByLabel("Password", { exact: true }).fill(password());
  await page.getByRole("button", { name: "Sign in to test account" }).click();
  await expect(page).toHaveURL(/\/feedback$/);
  await expect(page.getByLabel("Your message")).toBeVisible();
});

test("mobile dark mode keeps the draft after server-side validation fails", async ({ page }) => {
  await login(page, "moderator");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/feedback");
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await page.getByLabel("Your message").fill("A question about the live viewing controls.");
  // Simulate a stale/malformed form; the user must not lose their draft.
  await page.locator('input[name="submissionKey"]').evaluate((node) => (node as HTMLInputElement).value = "invalid");
  await page.getByRole("button", { name: "Send feedback", exact: true }).click();
  await expect(page.getByRole("form", { name: "Send feedback" }).getByRole("alert")).toContainText("Refresh this page");
  await expect(page.getByLabel("Your message")).toHaveValue("A question about the live viewing controls.");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/feedback-mobile-${test.info().project.name}.png`, fullPage: true });
});
