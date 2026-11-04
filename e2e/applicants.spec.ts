import { expect } from "@playwright/test";
import { db, E2E, login, pageAs, SEALED_NAMES, test } from "./helpers";

test("competition admins see only applicant basics before results release", async ({ browser }) => {
  const comp = await pageAs(browser, "comp");
  const competition = await db.competitionProfile.findUniqueOrThrow({
    where: { slug: E2E.comps.showcase.slug },
    select: { id: true },
  });
  const applications = await db.application.findMany({
    where: { competitionId: competition.id },
    include: { team: { select: { id: true, name: true } } },
  });

  await comp.goto("/comp/applicants");
  await expect(comp.getByRole("heading", { name: "Applied teams" })).toBeVisible();
  await expect(comp.getByText(E2E.teams.mine.name, { exact: true })).toHaveCount(0);
  for (const application of applications) {
    const row = comp.getByRole("listitem").filter({ hasText: application.team.name });
    await expect(row).toContainText("2 dancers");
    await expect(row).toContainText("Applied");
    await expect(row.locator("time")).toHaveAttribute("datetime", application.createdAt.toISOString());
    await expect(comp.getByRole("link", { name: application.team.name })).toHaveCount(0);
  }
  await expect(comp.getByText("Dancer One")).toHaveCount(0);
  await expect(comp.getByText("Test Captain")).toHaveCount(0);
  await expect(comp.getByText("Team 1", { exact: true })).toHaveCount(0);
  await expect(comp.getByText("Pending", { exact: true })).toHaveCount(0);
  await expect(comp.locator("main")).not.toContainText("drive.google.com");

  await comp.goto(`/comp/applicants/${applications[0].team.id}`);
  await expect(comp.getByText("404", { exact: true })).toBeVisible();

  await db.competitionProfile.update({
    where: { id: competition.id },
    data: { resultsReleasedAt: new Date() },
  });
  await comp.goto("/comp/applicants");
  await expect(comp.getByRole("link", { name: applications[0].team.name })).toBeVisible();
  await comp.getByRole("link", { name: applications[0].team.name }).click();
  await expect(comp.getByRole("rowheader", { name: "Dancer One" })).toBeVisible();
  const nonApplicant = await db.teamProfile.findUniqueOrThrow({
    where: { slug: E2E.teams.mine.slug },
    select: { id: true },
  });
  await comp.goto(`/comp/applicants/${nonApplicant.id}`);
  await expect(comp.getByText("404", { exact: true })).toBeVisible();
});

test("hosts across time zones see the same application at their local date and time", async ({ browser }) => {
  const application = await db.application.findFirstOrThrow({
    where: { competition: { slug: E2E.comps.showcase.slug } },
    include: { team: true },
  });
  const submittedAt = new Date("2026-11-02T04:35:00.000Z");
  await db.application.update({ where: { id: application.id }, data: { createdAt: submittedAt } });
  const cases = [
    { zone: "America/Los_Angeles", expected: /Nov 1, 2026.*8:35 PM Pacific Time/ },
    { zone: "America/New_York", expected: /Nov 1, 2026.*11:35 PM Eastern Time/ },
    { zone: "Europe/London", expected: /Nov 2, 2026.*4:35 AM/ },
    { zone: "Asia/Kolkata", expected: /Nov 2, 2026.*10:05 AM/ },
    { zone: "Pacific/Auckland", expected: /Nov 2, 2026.*5:35 PM/ },
  ];
  for (const { zone, expected } of cases) {
    const context = await browser.newContext({ timezoneId: zone });
    try {
      const page = await context.newPage();
      await login(page, "comp");
      await page.goto("/comp/applicants");
      const row = page.getByRole("listitem").filter({ hasText: application.team.name });
      await expect(row.locator("time")).toHaveAttribute("datetime", submittedAt.toISOString());
      await expect(row.locator("time")).toHaveText(expected);
    } finally {
      await context.close();
    }
  }
});

test("moderator-only and judge accounts cannot see applicant names", async ({ browser }) => {
  for (const role of ["moderator", "judge"] as const) {
    const page = await pageAs(browser, role);
    const response = await page.request.get("/comp/applicants", { maxRedirects: 0 });
    const html = await response.text();
    for (const name of SEALED_NAMES) expect(html).not.toContain(name);
    await page.goto("/comp/applicants");
    await expect(page).not.toHaveURL(/\/comp\/applicants(?:\/|$)/);
  }
});

test("affiliate hosts cannot open applicant details before release", async ({ browser }) => {
  const competition = await db.competitionProfile.update({
    where: { slug: E2E.comps.showcase.slug },
    data: { isPartner: false, isAffiliate: true },
  });
  const application = await db.application.findFirstOrThrow({ where: { competitionId: competition.id } });
  const comp = await pageAs(browser, "comp");
  await comp.goto("/comp/applicants");
  await expect(comp.getByRole("link", { name: E2E.teams.alpha.name })).toHaveCount(0);
  await comp.goto(`/comp/applicants/${application.teamId}`);
  await expect(comp.getByText("404", { exact: true })).toBeVisible();
});

test("optional captain phone contacts stay paired with names and are visible before viewing", async ({ browser }) => {
  const teamPage = await pageAs(browser, "team");
  await teamPage.goto("/team/profile");
  await teamPage.getByLabel("Captain 1 name").fill("Test Captain");
  await teamPage.getByLabel("Captain 1 phone").fill("+1 (555) 123-4567");
  await teamPage.getByRole("button", { name: "Save Team Profile" }).click();
  await expect(teamPage.getByText("Changes saved.")).toBeVisible();
  const saved = await db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } });
  expect(saved.captainContacts).toEqual([{ name: "Test Captain", phone: "+1 (555) 123-4567" }]);

  const competition = await db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const application = await db.application.findFirstOrThrow({ where: { competitionId: competition.id } });
  await db.teamProfile.update({
    where: { id: application.teamId },
    data: { captainContacts: [{ name: "Captain One", phone: "555-123-4567" }] },
  });
  const host = await pageAs(browser, "comp");
  for (const type of [
    { isPartner: true, isAffiliate: false },
    { isPartner: false, isAffiliate: true },
    { isPartner: false, isAffiliate: false },
  ]) {
    await db.competitionProfile.update({ where: { id: competition.id }, data: type });
    await host.goto("/comp/applicants");
    const row = host.getByRole("listitem").filter({ hasText: "Captain One" });
    await expect(row).toContainText("Captain One · 555-123-4567");
    await expect(row).not.toContainText("drive.google.com");
  }
});

test("non-partner hosts can see applicant profiles and submitted AVs before release", async ({ browser }) => {
  const competition = await db.competitionProfile.update({
    where: { slug: E2E.comps.showcase.slug },
    data: { isPartner: false, isAffiliate: false },
  });
  const application = await db.application.findFirstOrThrow({
    where: { competitionId: competition.id },
    include: { team: true },
  });
  const submittedAvDriveUrl = "https://drive.google.com/file/d/1E2ESubmittedSnapshotAAAAAAAAAAAA/view";
  await db.application.update({ where: { id: application.id }, data: { submittedAvDriveUrl } });
  const comp = await pageAs(browser, "comp");
  await comp.goto("/comp/applicants");
  for (const name of SEALED_NAMES) {
    await expect(comp.getByRole("link", { name })).toBeVisible();
  }
  await expect(comp.getByRole("link", { name: "Download final team workbook" })).toHaveCount(0);
  expect((await comp.request.get("/api/comp/applicants/export")).status()).toBe(403);
  await comp.getByRole("link", { name: application.team.name }).click();
  await expect(comp.getByRole("rowheader", { name: "Dancer One" })).toBeVisible();
  await expect(comp.getByTitle(`${application.team.name} audition video`)).toHaveAttribute("src", /1E2ESubmittedSnapshotAAAAAAAAAAAA/);
  await expect(comp.getByRole("link", { name: "Open In Drive" })).toHaveAttribute("href", submittedAvDriveUrl);

  for (const role of ["team", "moderator", "judge"] as const) {
    const page = await pageAs(browser, role);
    await page.goto(`/comp/applicants/${application.teamId}`);
    await expect(page).not.toHaveURL(new RegExp(`/comp/applicants/${application.teamId}$`));
  }

  await db.application.update({ where: { id: application.id }, data: { removedAt: new Date() } });
  await comp.goto(`/comp/applicants/${application.teamId}`);
  await expect(comp.getByText("404", { exact: true })).toBeVisible();
  await comp.goto("/comp/applicants");
  await expect(comp.getByRole("link", { name: application.team.name })).toHaveCount(0);
});
