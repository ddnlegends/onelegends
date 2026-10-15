import { expect } from "@playwright/test";
import { db, E2E, login, pageAs, test } from "./helpers";

test("competition hosts and teams see active listings grouped by type", async ({ page, browser }) => {
  const nonPartner = await db.competitionProfile.create({
    data: {
      slug: "e2e-non-partner-open",
      claimCode: "COMP-E2ENPO",
      name: "E2E Non-partner Open",
      isPartner: false,
      claimedAt: new Date(),
      dates: "Fixture dates",
      location: "Test City",
      venue: "Test Hall",
      stageSize: "40 x 32 feet",
      lighting: "Standard AV guidelines",
      productionNotes: "Standard production setup",
      description: "Fixture competition details",
      acceptingApps: true,
      earlyApplicationDeadline: new Date(Date.now() + 7 * 86_400_000),
      applicationDeadline: new Date(Date.now() + 14 * 86_400_000),
      regularApplicationFeeCents: 3500,
      lateApplicationFeeCents: 5000,
    },
  });
  try {
    await login(page, "comp");
    await page.getByRole("navigation").getByRole("link", { name: "All Competitions" }).click();
    await expect(page).toHaveURL(/\/comp\/competitions$/);
    await expect(page.getByRole("region", { name: "Partner Competitions" }).getByRole("link", { name: E2E.comps.open.name })).toBeVisible();
    const nonPartnerSection = page.getByRole("region", { name: "Non-partner Competitions" });
    await expect(nonPartnerSection.getByRole("link", { name: nonPartner.name })).toBeVisible();
    await expect(nonPartnerSection).toContainText("$35.00");
    await expect(nonPartnerSection).toContainText("$50.00");
    await expect(page.getByText(E2E.comps.closed.name)).toHaveCount(0);

    const teamPage = await pageAs(browser, "team");
    await teamPage.goto("/team/apply");
    await expect(teamPage.getByRole("region", { name: "Partner Competitions", exact: true })).toContainText(E2E.comps.open.name);
    await expect(teamPage.getByRole("region", { name: "Non-partner Competitions", exact: true })).toContainText(nonPartner.name);
    await expect(teamPage.getByRole("region", { name: "Partner Competitions not accepting applications" })).toContainText(E2E.comps.closed.name);
    await teamPage.goto("/comp/competitions");
    await expect(teamPage).toHaveURL(/\/dashboard$/);
  } finally {
    await db.competitionProfile.delete({ where: { id: nonPartner.id } });
  }
});
