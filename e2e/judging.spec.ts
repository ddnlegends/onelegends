import { expect, test, type Page } from "@playwright/test";
import { competitionId, E2E, pageAs, SEALED_NAMES } from "./helpers";

const SCORES = {
  1: { choreography: "8", formations: "7", technique: "9", syncCleanliness: "8", overallImpression: "9" },
  2: { choreography: "6", formations: "6", technique: "5", syncCleanliness: "7", overallImpression: "6" },
} as const;

async function expectNoTeamNames(page: Page) {
  const html = await page.content();
  for (const name of SEALED_NAMES) {
    expect(html, `${page.url()} revealed ${name}`).not.toContain(name);
  }
}

async function scoreTeam(page: Page, scores: Record<string, string>) {
  for (const [field, value] of Object.entries(scores)) {
    await page.locator(`#${field}`).selectOption(value);
  }
  await expect(page.getByText(/Saved total:/)).toBeVisible();
}

test("ops opens judging, REG drives the screen, a judge scores, and results release", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const id = await competitionId(E2E.comps.showcase.slug);

  const ops = await pageAs(browser, "tech");
  await ops.goto(`/ops/comps/${id}`);
  await ops.getByRole("button", { name: "Open judging" }).click();
  await expect(ops.getByText(/Judging is open\. REG can start/)).toBeVisible();

  const reg = await pageAs(browser, "reg");
  await reg.goto(`/reg/${id}`);
  await expect(reg.getByRole("heading", { name: "Ready when you are" })).toBeVisible();
  await expectNoTeamNames(reg);
  await reg.getByRole("button", { name: "Show Team 1" }).click();
  await expect(reg.getByRole("heading", { name: "Team 1" })).toBeVisible();

  const judge = await pageAs(browser, "judge");
  await judge.goto(`/judge/${id}`);
  await expect(judge.getByText("Live", { exact: true })).toBeVisible();
  await expectNoTeamNames(judge);

  await judge.goto(`/judge/${id}/team/1`);
  await expectNoTeamNames(judge);
  await scoreTeam(judge, SCORES[1]);
  await judge.locator("#comment").fill("Strong opener");
  await judge.locator("#comment").blur();

  await judge.getByRole("link", { name: "Team 2" }).click();
  await expect(judge).toHaveURL(/\/team\/2/);
  await scoreTeam(judge, SCORES[2]);

  const comp = await pageAs(browser, "comp");
  await comp.goto("/comp/results");
  await expect(comp.getByText(/Team names are still hidden/)).toBeVisible();
  await expectNoTeamNames(comp);

  await expect(async () => {
    await reg.reload();
    await expect(reg.getByLabel("E2E Judge completed Team 2")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expectNoTeamNames(reg);

  await expect(async () => {
    await judge.goto(`/judge/${id}`);
    await expect(judge.getByText("2 of 2 fully scored")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await judge.getByRole("button", { name: "Submit Judging" }).click();
  await expect(judge.getByText(/Packet submitted/).first()).toBeVisible();

  await comp.reload();
  await expect(comp.getByText(/Unlocked/)).toBeVisible();
  for (const name of SEALED_NAMES) {
    await expect(comp.getByRole("cell", { name, exact: true })).toBeVisible();
  }
  await expect(comp.getByText("Strong opener")).toBeVisible();

  await reg.reload();
  await expect(reg.getByText("Judging is complete for this competition.")).toBeVisible();
});
