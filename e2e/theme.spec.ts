import { expect, type Page } from "@playwright/test";
import { test, login } from "./helpers";

const themeSelect = (page: Page) => page.getByRole("combobox", { name: "Color theme" });

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
  await expect(themeSelect(page)).toHaveValue("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "light");
  await themeSelect(page).selectOption("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "dark");
  await themeSelect(page).selectOption("system");
  await expectTheme(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "dark");
});

test("theme persists across navigation and reload and syncs between tabs", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await themeSelect(page).selectOption("dark");
  await page.getByRole("navigation").getByRole("link", { name: "Payments" }).click();
  await expect(page).toHaveURL(/\/payments/);
  await expectTheme(page, "dark");
  await page.reload();
  await expect(themeSelect(page)).toHaveValue("dark");
  await expectTheme(page, "dark");

  const otherTab = await context.newPage();
  await otherTab.emulateMedia({ colorScheme: "light" });
  await otherTab.goto("/login");
  await expectTheme(otherTab, "dark");
  await themeSelect(otherTab).selectOption("light");
  await expect(themeSelect(page)).toHaveValue("light");
  await expectTheme(page, "light");
  await otherTab.reload();
  await expect(themeSelect(otherTab)).toHaveValue("light");
  await otherTab.emulateMedia({ colorScheme: "dark" });
  await themeSelect(otherTab).selectOption("system");
  await expectTheme(otherTab, "dark");
  await expect(themeSelect(page)).toHaveValue("system");
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
  await expect(themeSelect(page)).toHaveValue("system");
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
  await themeSelect(page).selectOption("light");
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
  await expect(themeSelect(page)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await login(page, "team");
  await expectTheme(page, "dark");
  await page.goto("/team/profile");
  const field = page.locator("textarea").first();
  await expect(field).toBeVisible();
  await expect(field).toHaveCSS("background-color", "rgb(33, 26, 34)");
  await field.fill("An unsaved team profile draft");
  await themeSelect(page).selectOption("light");
  await expect(field).toHaveValue("An unsaved team profile draft");
  await expect(field).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await themeSelect(page).selectOption("dark");
  await expect(field).toHaveValue("An unsaved team profile draft");
  await expectTheme(page, "dark");
});
