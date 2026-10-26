import { expect } from "@playwright/test";
import { test, db, E2E, login } from "./helpers";

test("tech admin can remove one duplicate competition without removing the other", async ({ page }) => {
  const original = await db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const duplicate = await db.competitionProfile.create({ data: {
    slug: "e2e-showcase-duplicate", claimCode: "COMP-E2EDUP", name: original.name,
    isPartner: true, dates: "Duplicate event date", location: "Duplicate City",
  } });
  await login(page, "tech");
  await page.goto("/ops/competitions");
  const row = page.locator("article").filter({ hasText: original.name }).filter({ hasText: "Duplicate event date" });
  await row.locator("button[aria-expanded]").click();
  await row.getByRole("button", { name: "Delete competition" }).click();
  await row.getByLabel("Type the exact competition name").fill(original.name);
  await row.getByLabel("Type the exact claim code").fill(duplicate.claimCode);
  await row.getByLabel("Type DELETE").fill("DELETE");
  await row.getByLabel("Reason for deletion").fill("Duplicate entry test");
  await row.getByRole("button", { name: "Permanently delete" }).click();
  await expect.poll(async () => db.competitionProfile.findUnique({ where: { id: duplicate.id } })).toBeNull();
  expect(await db.competitionProfile.findUnique({ where: { id: original.id } })).not.toBeNull();
});
