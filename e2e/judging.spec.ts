import { test } from "./helpers";
import { expect, type Page } from "@playwright/test";
import { competitionId, db, E2E, pageAs, SEALED_NAMES } from "./helpers";

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

test("ops opens judging, moderator drives the screen, a judge scores, and results release", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const id = await competitionId(E2E.comps.showcase.slug);

  const ops = await pageAs(browser, "tech");
  await ops.goto(`/ops/comps/${id}`);
  await ops.getByRole("button", { name: "Open judging" }).click();
  await expect(ops.getByText(/Judging is open\. The moderator can start/)).toBeVisible();

  const moderator = await pageAs(browser, "moderator");
  await moderator.goto(`/moderator/${id}`);
  await expect(moderator.getByRole("heading", { name: "Ready when you are" })).toBeVisible();
  await expectNoTeamNames(moderator);
  await moderator.getByRole("button", { name: "Show Team 1" }).click();
  await expect(moderator.getByRole("heading", { name: "Team 1" })).toBeVisible();
  await expect(moderator.getByRole("button", { name: /Next: Team 2/ })).toBeDisabled();

  const judge = await pageAs(browser, "judge");
  await judge.goto(`/judge/${id}`);
  await expect(judge.getByText("Live", { exact: true })).toBeVisible();
  await expectNoTeamNames(judge);

  await judge.goto(`/judge/${id}/team/1`);
  await expectNoTeamNames(judge);
  await expect(judge.getByRole("link", { name: "Team 2" })).toHaveCount(0);
  await judge.goto(`/judge/${id}/team/2?stay=1`);
  await expect(judge.locator("#choreography")).toBeDisabled();
  await judge.goto(`/judge/${id}/team/1`);
  await scoreTeam(judge, SCORES[1]);
  await judge.locator("#comment").fill("Strong opener");
  await judge.locator("#comment").blur();

  await expect(async () => {
    await moderator.reload();
    await expect(moderator.getByRole("button", { name: /Next: Team 2/ })).toBeEnabled({ timeout: 2_000 });
  }).toPass();
  await moderator.getByRole("button", { name: /Next: Team 2/ }).click();
  await expect(judge).toHaveURL(/\/team\/2/);
  await scoreTeam(judge, SCORES[2]);
  await judge.getByRole("link", { name: "Team 1" }).click();
  await expect(judge.locator("#choreography")).toBeEnabled();
  await judge.locator("#choreography").selectOption("9");

  const comp = await pageAs(browser, "comp");
  await comp.goto("/comp/results");
  await expect(comp.getByText(/Team names are still hidden/)).toBeVisible();
  await expectNoTeamNames(comp);

  await expect(async () => {
    await moderator.reload();
    await expect(moderator.getByLabel("E2E Judge completed Team 2")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expectNoTeamNames(moderator);

  await expect(async () => {
    await judge.goto(`/judge/${id}`);
    await expect(judge.getByText("2 of 2 fully scored")).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await judge.getByRole("button", { name: "Submit Judging" }).click();
  await expect(judge.getByText(/Packet submitted/).first()).toBeVisible();

  const stored = await db.judgeAssignment.findFirstOrThrow({
    where: { competitionId: id, judge: { user: { email: E2E.emails.judge } } },
    include: { slots: { orderBy: { position: "asc" }, include: { score: true } }, competition: true },
  });
  expect(stored.submittedAt).not.toBeNull();
  expect(stored.competition.resultsReleasedAt).not.toBeNull();
  expect(stored.competition.judgingOpen).toBe(false);
  expect(stored.competition.livePosition).toBeNull();
  for (const slot of stored.slots) {
    const expected = SCORES[slot.position as keyof typeof SCORES];
    for (const [field, value] of Object.entries(expected)) {
      expect(slot.score?.[field as keyof typeof slot.score]).toBe(
        slot.position === 1 && field === "choreography" ? 9 : Number(value),
      );
    }
  }
  await judge.goto(`/judge/${id}/team/1`);
  await expect(judge.locator("#choreography")).toBeDisabled();

  await comp.reload();
  await expect(comp.getByText(/Unlocked/)).toBeVisible();
  for (const name of SEALED_NAMES) {
    await expect(comp.getByRole("cell", { name, exact: true })).toBeVisible();
  }
  await expect(comp.getByText("Strong opener")).toBeVisible();

  await moderator.reload();
  await expect(moderator.getByText("Judging is complete for this competition.")).toBeVisible();
});
