import { expect } from "@playwright/test";
import { db, E2E, pageAs, SEALED_NAMES, test } from "./helpers";
import { formatDate } from "../src/lib/utils";

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
    await expect(row).toContainText(`Applied ${formatDate(application.createdAt)}`);
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

test("non-partner competition admins get the same applicant list", async ({ browser }) => {
  await db.competitionProfile.update({
    where: { slug: E2E.comps.showcase.slug },
    data: { isPartner: false },
  });
  const comp = await pageAs(browser, "comp");
  await comp.goto("/comp/applicants");
  for (const name of SEALED_NAMES) {
    await expect(comp.getByText(name, { exact: true })).toBeVisible();
  }
});
