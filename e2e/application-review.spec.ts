import { expect } from "@playwright/test";
import { db, E2E, pageAs, test } from "./helpers";

test("teams browse competition details and packets before adding an AV", async ({ browser }) => {
  await db.teamProfile.update({
    where: { slug: E2E.teams.mine.slug },
    data: { avDriveUrl: "", blurb: "" },
  });
  const competition = await db.competitionProfile.update({
    where: { slug: E2E.comps.open.slug },
    data: { applicationPacketDriveUrl: "https://drive.google.com/file/d/1E2EPacketFixtureAAAAAAAAAAAAAAA/view" },
  });
  const team = await pageAs(browser, "team");
  await team.goto("/team");
  await team.getByRole("link", { name: "Browse competitions" }).click();
  await expect(team.getByText("Complete your profile before applying.", { exact: false }).first()).toBeVisible();
  const listing = team.getByRole("listitem").filter({ hasText: competition.name });
  await expect(listing.getByRole("link", { name: "Details, payment & packet" })).toBeVisible();
  await expect(team.getByRole("checkbox", { name: competition.name })).toHaveCount(0);
  await expect(team.getByRole("button", { name: "Apply to selected comps" })).toHaveCount(0);
  await listing.getByRole("link", { name: "Details, payment & packet" }).click();
  await expect(team.getByRole("heading", { name: "Application packet" })).toBeVisible();
  await expect(team.getByRole("link", { name: "Open application packet on Google Drive" })).toHaveAttribute("href", competition.applicationPacketDriveUrl!);
});

test("teams review their saved application AV and current profile without exposing unreleased decisions", async ({ browser }) => {
  const teamProfile = await db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.mine.slug } });
  const competition = await db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.open.slug } });
  const submittedAvDriveUrl = "https://drive.google.com/file/d/1E2ESubmittedSnapshotAAAAAAAAAAAA/view";
  const application = await db.application.create({
    data: {
      teamId: teamProfile.id,
      competitionId: competition.id,
      submittedAvDriveUrl,
      appliedPhase: "EARLY",
      expectedFeeCents: 5000,
      status: "ACCEPTED",
    },
  });
  const team = await pageAs(browser, "team");
  await team.goto("/team");
  await team.getByRole("link", { name: "Review application" }).click();
  await expect(team.getByRole("heading", { name: "Review application" })).toBeVisible();
  await expect(team.getByText("Early", { exact: true })).toBeVisible();
  await expect(team.getByText("$50.00", { exact: true })).toBeVisible();
  await expect(team.getByText("Pending", { exact: true })).toBeVisible();
  await expect(team.getByText("Accepted", { exact: true })).toHaveCount(0);
  await expect(team.getByRole("link", { name: "Open In Drive" })).toHaveAttribute("href", submittedAvDriveUrl);

  await db.teamProfile.update({
    where: { id: teamProfile.id },
    data: { blurb: "Updated profile after applying", avDriveUrl: "https://drive.google.com/file/d/1E2ECurrentProfileAAAAAAAAAAAAAAA/view" },
  });
  await db.dancer.create({ data: { teamId: teamProfile.id, name: "New Dancer", tshirtSize: "S" } });
  await team.reload();
  await expect(team.getByText("Updated profile after applying")).toBeVisible();
  await expect(team.getByRole("rowheader", { name: "New Dancer" })).toBeVisible();
  await expect(team.getByRole("link", { name: "Open In Drive" })).toHaveAttribute("href", submittedAvDriveUrl);

  const host = await pageAs(browser, "comp");
  const response = await host.request.get(`/team/applications/${application.id}`, { maxRedirects: 0 });
  expect(await response.text()).not.toContain(submittedAvDriveUrl);
});
