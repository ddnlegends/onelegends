import { expect } from "@playwright/test";
import { db, E2E, pageAs, test } from "./helpers";

test("Partner and Affiliate hosts cannot use rolling decisions", async ({ browser }) => {
  const host = await pageAs(browser, "comp");
  for (const type of [
    { isPartner: true, isAffiliate: false },
    { isPartner: false, isAffiliate: true },
  ]) {
    await db.competitionProfile.update({ where: { slug: E2E.comps.showcase.slug }, data: type });
    await host.goto("/comp/decisions");
    await expect(host.getByText("404", { exact: true })).toBeVisible();
  }
});

test("Non-partner hosts publish one rolling decision without revealing drafts", async ({ browser }) => {
  const competition = await db.competitionProfile.update({
    where: { slug: E2E.comps.showcase.slug },
    data: { isPartner: false, isAffiliate: false },
  });
  const team = await db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } });
  const application = await db.application.create({ data: { teamId: team.id, competitionId: competition.id } });
  const host = await pageAs(browser, "comp");
  const applicant = await pageAs(browser, "team");

  await host.goto("/comp/decisions");
  await expect(host.getByRole("heading", { name: "Rolling decisions" })).toBeVisible();
  await applicant.goto("/team/decisions");
  await expect(applicant.getByText("Decision not announced").first()).toBeVisible();

  await host.getByLabel(`Decision for ${team.name}`).selectOption("ACCEPTED");
  let row = host.locator("form").filter({ has: host.getByLabel(`Decision for ${team.name}`) });
  await row.getByRole("button", { name: "Save draft" }).click();
  await expect(host.getByText("Accepted draft · private")).toBeVisible();
  expect((await db.application.findUniqueOrThrow({ where: { id: application.id } })).decisionPublishedAt).toBeNull();
  await applicant.reload();
  await expect(applicant.getByText("Decision not announced").first()).toBeVisible();

  await host.getByLabel(`Decision for ${team.name}`).selectOption("ACCEPTED");
  row = host.locator("form").filter({ has: host.getByLabel(`Decision for ${team.name}`) });
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "Publish to team" }).click();
  await expect(host.getByText("Published", { exact: true })).toHaveCount(1);
  expect((await db.application.findUniqueOrThrow({ where: { id: application.id } })).decisionPublishedAt).not.toBeNull();

  await applicant.reload();
  await expect(applicant.getByText("Offer · response needed")).toBeVisible();
  await applicant.getByRole("button", { name: "Decline offer" }).click();
  await applicant.getByRole("button", { name: "Yes, decline" }).click();
  await expect(applicant.getByText("Declined by team")).toBeVisible();

  await host.reload();
  await host.getByRole("button", { name: "Offer again" }).click();
  await host.getByRole("button", { name: "Yes, offer spot" }).click();
  await expect(host.getByText("Offer · response needed")).toBeVisible();
  await applicant.reload();
  await applicant.getByRole("button", { name: "Confirm spot" }).click();
  await applicant.getByRole("button", { name: "Yes, confirm my spot" }).click();
  await expect(applicant.getByText("Confirmed by team")).toBeVisible();
});
