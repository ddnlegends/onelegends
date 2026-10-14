import { test } from "./helpers";
import { expect } from "@playwright/test";
import { db, E2E, login, pageAs } from "./helpers";

test("roster contact flags persist and appear in exports", async ({ page, browser }) => {
  await login(page, "team");
  await page.goto("/team/profile");

  const contact = page.getByRole("checkbox", { name: "Point of Contact: Dancer One" });
  await expect(contact).not.toBeChecked();
  await expect(page.getByText("Sober Monitor")).toHaveCount(0);
  await contact.check();
  await page.getByRole("button", { name: "Save roster" }).click();
  await expect(page.locator(".notice-ok")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Point of Contact: Dancer One" })).toBeChecked();
  await expect(page.getByText("Sober Monitor")).toHaveCount(0);
  const team = await db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } });
  const dancer = await db.dancer.findFirstOrThrow({ where: { teamId: team.id, name: "Dancer One" } });
  expect(dancer.pointOfContact).toBe(true);

  const tech = await pageAs(browser, "tech");
  await tech.goto(`/ops/teams/${team.id}`);
  await expect(tech.getByRole("row", { name: /Dancer One/ }).getByRole("cell").nth(1)).toHaveText("Yes");
  await expect(tech.getByText("Sober Monitor")).toHaveCount(0);
  const exportResponse = await tech.request.get("/api/ops/export?dataset=rosters&format=csv");
  expect(exportResponse.status()).toBe(200);
  const csv = await exportResponse.text();
  expect(csv).toContain("In AV,Point of Contact,Dietary restrictions");
  expect(csv).toContain(`${team.name},Dancer One,Yes,Yes,`);
  expect(csv).not.toContain("Sober Monitor");
});
