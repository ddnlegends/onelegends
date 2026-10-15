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

test("competition admin sets ordered regular and late deadlines", async ({ page, browser }) => {
  const original = await db.competitionProfile.findUniqueOrThrow({
    where: { slug: E2E.comps.showcase.slug },
    select: { id: true, earlyApplicationDeadline: true, applicationDeadline: true },
  });
  const visitor = await browser.newPage();
  try {
    await login(page, "comp");
    await page.goto("/comp/profile");
    await page.getByLabel("Regular application deadline").fill("2027-01-20T12:00");
    await page.getByLabel("Late application deadline").fill("2027-01-10T12:00");
    await page.getByRole("button", { name: "Save Details" }).click();
    await expect(page.locator(".notice-error")).toContainText("regular deadline must be before the late deadline");

    await page.getByLabel("Late application deadline").fill("2027-01-30T12:00");
    await page.getByRole("button", { name: "Save Details" }).click();
    await expect(page.locator(".notice-ok")).toContainText("Competition details saved");

    const updated = await db.competitionProfile.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated.earlyApplicationDeadline).not.toBeNull();
    expect(updated.applicationDeadline).not.toBeNull();
    expect(updated.earlyApplicationDeadline!.getTime()).toBeLessThan(updated.applicationDeadline!.getTime());

    // The save confirmation also refreshes the host page. Check the public
    // listing as a visitor so that refresh cannot cancel WebKit's navigation.
    await visitor.goto(`/comps/${original.id}`);
    await expect(visitor.getByText("Regular application deadline")).toBeVisible();
    await expect(visitor.getByText("Late application deadline")).toBeVisible();
  } finally {
    await visitor.close();
    await db.competitionProfile.update({
      where: { id: original.id },
      data: {
        earlyApplicationDeadline: original.earlyApplicationDeadline,
        applicationDeadline: original.applicationDeadline,
      },
    });
  }
});
