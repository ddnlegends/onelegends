import { expect } from "@playwright/test";
import { login, test } from "./helpers";

test("all role walkthroughs work by keyboard on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const teams = page.getByRole("tab", { name: "Teams", exact: true });
  await teams.focus();
  await teams.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Judges", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Judges", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Judges", exact: true }).press("End");
  const ops = page.getByRole("tab", { name: "Circuit ops", exact: true });
  await expect(ops).toBeFocused();
  await ops.press("ArrowRight");
  await expect(teams).toBeFocused();
  await teams.press("ArrowLeft");
  await expect(ops).toBeFocused();

  for (const role of ["Teams", "Judges", "Competitions", "Moderators", "Circuit ops"]) {
    const tab = page.getByRole("tab", { name: role, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel", { name: role, exact: true });
    await expect(panel).toBeVisible();
    const href = role === "Moderators" || role === "Circuit ops" ? "/login" : "/register";
    await expect(panel.getByRole("link")).toHaveAttribute("href", href);
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  }
  await ops.press("Home");
  await expect(teams).toBeFocused();
  await page.getByRole("navigation").getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { name: "How it works", level: 1 })).toBeVisible();
});

test("signed-in walkthroughs lead back to the user's dashboard", async ({ page }) => {
  await login(page, "team");
  await page.getByRole("navigation").getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  for (const role of ["Teams", "Judges", "Competitions", "Moderators", "Circuit ops"]) {
    await page.getByRole("tab", { name: role, exact: true }).click();
    await expect(page.getByRole("tabpanel", { name: role, exact: true })
      .getByRole("link", { name: "Your dashboard" })).toHaveAttribute("href", "/dashboard");
  }
  await page.getByRole("tabpanel", { name: "Circuit ops", exact: true })
    .getByRole("link", { name: "Your dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
});
