import { test } from "./helpers";
import { expect } from "@playwright/test";
import { ALL_CLAIM_CODES, db, E2E, login, SEALED_NAMES } from "./helpers";

const OPS_PAGES = ["/ops/teams", "/ops/competitions", "/ops/export", "/ops/comps"];

for (const path of OPS_PAGES) {
  test(`logged-out visitors get nothing from ${path}`, async ({ page, request }) => {
    // Layouts and pages render in parallel, so check the raw HTML, not just the redirect.
    const response = await request.get(path, { maxRedirects: 0 });
    const html = await response.text();
    for (const secret of [...ALL_CLAIM_CODES, ...SEALED_NAMES, E2E.emails.team]) {
      expect(html, `${path} leaked ${secret}`).not.toContain(secret);
    }

    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  });
}

test("a team admin cannot open tech-admin pages", async ({ page }) => {
  await login(page, "team");
  for (const path of OPS_PAGES) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    const html = await response.text();
    for (const code of ALL_CLAIM_CODES) {
      expect(html, `${path} leaked ${code}`).not.toContain(code);
    }
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard/);
  }
});

test("a tech admin sees every team and competition", async ({ page }) => {
  await login(page, "tech");
  await page.goto("/ops/teams");
  for (const team of Object.values(E2E.teams)) {
    await expect(page.getByText(team.name, { exact: true }).first()).toBeVisible();
  }
  await page.goto("/ops/competitions");
  for (const comp of Object.values(E2E.comps)) {
    await expect(page.getByText(comp.name, { exact: true }).first()).toBeVisible();
  }
});

test("circuit ops can create and relabel a non-partner competition", async ({ page }) => {
  const name = "E2E Non-partner Competition";
  await login(page, "tech");
  try {
    const form = page.getByRole("heading", { name: "Add a competition" }).locator("..", { hasText: "Add a competition" }).locator("..");
    await form.getByLabel("Competition name").fill(name);
    await form.getByLabel("Competition type").selectOption("non-partner");
    await form.getByRole("button", { name: "Create competition" }).click();
    await expect(form.locator(".notice-ok")).toContainText(name);

    // The create action also refreshes /dashboard; a page.goto here can race
    // that refresh (WebKit aborts it). The router queues a link click instead.
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Competitions", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ops\/competitions$/);
    const row = page.locator("article").filter({ hasText: name });
    await expect(row.getByText("Non-partner", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: /E2E Non-partner Competition/ }).click();
    await row.getByLabel("Competition type").selectOption("partner");
    await row.getByRole("button", { name: "Save type" }).click();
    await expect(row.locator("button").first().getByText("Partner", { exact: true })).toBeVisible();
    await expect(db.competitionProfile.findFirstOrThrow({ where: { name }, select: { isPartner: true } })).resolves.toMatchObject({ isPartner: true });
  } finally {
    await db.competitionProfile.deleteMany({ where: { name } });
  }
});
