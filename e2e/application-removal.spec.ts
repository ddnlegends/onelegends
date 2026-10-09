import { expect } from "@playwright/test";
import { competitionId, db, E2E, login, test } from "./helpers";

test("tech admin removes an unpaid applicant from the Comp Dashboard before judging", async ({ page }) => {
  const id = await competitionId(E2E.comps.showcase.slug);
  await login(page, "tech");
  await page.goto(`/ops/comps/${id}`);
  const review = page.getByRole("heading", { name: "Application payment review" }).locator("..").locator("..");
  await expect(review.getByText(E2E.teams.alpha.name)).toBeVisible();
  await expect(review.getByText(E2E.teams.beta.name)).toBeVisible();
  await review.getByRole("button", { name: `Remove ${E2E.teams.alpha.name} application` }).click();
  await expect(review.getByText(`Remove ${E2E.teams.alpha.name} from ${E2E.comps.showcase.name}?`)).toBeVisible();
  await review.getByRole("button", { name: "Confirm removal" }).click();
  await expect(review.getByRole("listitem").filter({ hasText: E2E.teams.alpha.name })).toHaveCount(0);
  await expect(review.getByText(E2E.teams.beta.name)).toBeVisible();
  await expect.poll(() => db.application.count({ where: { competitionId: id } })).toBe(1);
  await page.getByRole("button", { name: "Open judging" }).click();
  await expect.poll(() => db.judgeViewingSlot.count({ where: { assignment: { competitionId: id } } })).toBe(1);
});
