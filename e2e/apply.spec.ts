import { test } from "./helpers";
import { expect } from "@playwright/test";
import { db, E2E, login } from "./helpers";

test("a blocked team sees the circuit block instead of the form", async ({ page }) => {
  await db.teamProfile.update({
    where: { slug: E2E.teams.mine.slug },
    data: { applyBlocked: true, applyBlockReason: "E2E: unpaid dues" },
  });
  try {
    await login(page, "team");
    await page.goto("/team/apply");
    await expect(page.getByText(/Circuit ops has blocked this team from applying/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply to selected comps" })).toHaveCount(0);
  } finally {
    await db.teamProfile.update({
      where: { slug: E2E.teams.mine.slug },
      data: { applyBlocked: false, applyBlockReason: "" },
    });
  }
});

test("a complete team applies to an open competition only", async ({ page }) => {
  await login(page, "team");
  await page.goto("/team/apply");

  const closed = page.getByRole("heading", { name: "Not accepting apps" }).locator("..");
  await expect(closed.getByText(E2E.comps.closed.name)).toBeVisible();
  await expect(page.getByLabel(new RegExp(E2E.comps.closed.name))).toHaveCount(0);

  await page.getByLabel(new RegExp(E2E.comps.open.name)).check();
  await page.getByRole("button", { name: "Apply to selected comps" }).click();
  await expect(page.locator(".notice-ok")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Already applied")).toBeVisible();
});
