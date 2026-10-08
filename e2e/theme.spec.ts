import { expect, type Page } from "@playwright/test";
import { test, login } from "./helpers";

type ThemeChoice = "system" | "light" | "dark";
const themeGroup = (page: Page) => page.getByRole("group", { name: "Color theme" });
const themeButton = (page: Page, choice: ThemeChoice) =>
  themeGroup(page).getByRole("button", { name: `${choice[0].toUpperCase()}${choice.slice(1)} theme`, exact: true });

async function chooseTheme(page: Page, choice: ThemeChoice) {
  await themeButton(page, choice).click();
}

async function expectChoice(page: Page, choice: ThemeChoice) {
  await expect(themeButton(page, choice)).toHaveAttribute("aria-pressed", "true");
}

async function expectTheme(page: Page, theme: "light" | "dark") {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
  await expect(page.locator("body")).toHaveCSS(
    "background-color", theme === "dark" ? "rgb(21, 17, 22)" : "rgb(255, 255, 255)",
  );
}

test("system theme follows the device until an explicit choice is made", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expectTheme(page, "dark");
  await expectChoice(page, "system");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "light");
  await chooseTheme(page, "dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "dark");
  await chooseTheme(page, "system");
  await expectTheme(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "dark");
});

test("theme persists across navigation and reload and syncs between tabs", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await chooseTheme(page, "dark");
  await page.getByRole("navigation").getByRole("link", { name: "Payments" }).click();
  await expect(page).toHaveURL(/\/payments/);
  await expectTheme(page, "dark");
  await page.reload();
  await expectChoice(page, "dark");
  await expectTheme(page, "dark");

  const otherTab = await context.newPage();
  await otherTab.emulateMedia({ colorScheme: "light" });
  await otherTab.goto("/login");
  await expectTheme(otherTab, "dark");
  await chooseTheme(otherTab, "light");
  await expectChoice(page, "light");
  await expectTheme(page, "light");
  await otherTab.reload();
  await expectChoice(otherTab, "light");
  await otherTab.emulateMedia({ colorScheme: "dark" });
  await chooseTheme(otherTab, "system");
  await expectTheme(otherTab, "dark");
  await expectChoice(page, "system");
  await expectTheme(page, "light");
  await otherTab.close();
  expect(errors).toEqual([]);
});

test("a saved theme is applied before the app hydrates", async ({ page }) => {
  // Blocking the app bundles leaves only the synchronous document-head script.
  await page.route(/\/_next\/.*\.js(?:\?|$)/, (route) => route.abort());
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("onelegends-theme", "dark"));
  await page.goto("/login");
  await expectTheme(page, "dark");
});

test("invalid saved values fall back to the device theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("onelegends-theme", "invalid"));
  await page.goto("/login");
  await expectTheme(page, "dark");
  await expectChoice(page, "system");
});

test("blocked browser storage still allows switching themes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Storage blocked", "SecurityError"); },
    });
  });
  await page.goto("/login");
  await expectTheme(page, "dark");
  await chooseTheme(page, "light");
  await expectTheme(page, "light");
  await page.getByRole("navigation").getByRole("link", { name: "Payments" }).click();
  await expect(page).toHaveURL(/\/payments/);
  await expectTheme(page, "light");
  expect(errors).toEqual([]);
});

test("dark mode fits a small screen and preserves an in-progress form", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(themeGroup(page)).toBeInViewport();
  await expect(themeGroup(page)).toHaveCSS("position", "fixed");
  const position = await themeGroup(page).boundingBox();
  expect(position).not.toBeNull();
  expect(position!.x + position!.width).toBeGreaterThan(350);
  expect(position!.y).toBeLessThan(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await login(page, "team");
  await expectTheme(page, "dark");
  await page.goto("/team/profile");
  const field = page.locator("textarea").first();
  await expect(field).toBeVisible();
  await expect(field).toHaveCSS("background-color", "rgb(33, 26, 34)");
  await field.fill("An unsaved team profile draft");
  await chooseTheme(page, "light");
  await expect(field).toHaveValue("An unsaved team profile draft");
  await expect(field).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await chooseTheme(page, "dark");
  await expect(field).toHaveValue("An unsaved team profile draft");
  await expectTheme(page, "dark");
});
