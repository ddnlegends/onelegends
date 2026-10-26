import { expect } from "@playwright/test";
import { test, db, E2E, competitionId, login } from "./helpers";

test("Reg access is admin only, assigned only, and Partner Competition only", async ({ page }) => {
  const id = await competitionId(E2E.comps.showcase.slug);
  await login(page, "team");
  await page.goto("/ops/reg");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`/ops/reg/${id}`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().clearCookies();

  await login(page, "tech");
  await page.goto("/ops/reg");
  await expect(page.getByText("No comp assigned.")).toBeVisible();
  await db.competitionRegAssignment.create({ data: {
    competitionId: id, email: E2E.emails.tech, contactName: "E2E Tech Admin", assignedByEmail: E2E.emails.tech,
  } });
  await page.reload();
  await expect(page.getByRole("link", { name: /E2E Showcase/ })).toBeVisible();
  await page.goto(`/ops/reg/${id}`);
  await expect(page.getByRole("heading", { name: "E2E Showcase" })).toBeVisible();
  await page.getByRole("button", { name: "Mark submitted AVs reviewed" }).click();
  await expect(page.getByText("AV review recorded.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Status: Reviewed")).toBeVisible();
  const changed = await db.application.findFirstOrThrow({ where: { competitionId: id } });
  await db.application.update({ where: { id: changed.id }, data: {
    submittedAvDriveUrl: "https://drive.google.com/file/d/1E2EchangedVideoIdAAAAAAAAAAAA/view",
  } });
  await page.reload();
  await expect(page.getByText("Status: Needs another review: applications or AV links changed")).toBeVisible();
  await page.getByLabel("Follow-up note").fill("Confirm host payment list");
  await page.getByRole("button", { name: "Save tracking" }).click();
  await expect(page.getByText("Note saved.")).toBeVisible();
  expect((await db.competitionRegAssignment.findUniqueOrThrow({ where: { competitionId: id } })).followUpNote).toBe("Confirm host payment list");

  await db.competitionProfile.update({ where: { id }, data: { isPartner: false } });
  await page.goto("/ops/reg");
  await expect(page.getByText("No comp assigned.")).toBeVisible();
  await page.goto(`/ops/reg/${id}`);
  await expect(page.getByText("404", { exact: true })).toBeVisible();
});

test("partner host sees assigned Reg chair and pending invite can be chosen", async ({ page }) => {
  const id = await competitionId(E2E.comps.showcase.slug);
  const email = "rithika.shenoy@desidancenetwork.org";
  await db.platformAdminInvite.create({ data: { email } });
  await login(page, "tech");
  await page.goto("/ops/reg/assignments");
  const row = page.locator("section").filter({ has: page.getByRole("heading", { name: "E2E Showcase" }) });
  await row.getByLabel("Reg chair").selectOption(email);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Assigned Rithika Shenoy.")).toBeVisible();
  const assignment = await db.competitionRegAssignment.findUniqueOrThrow({ where: { competitionId: id } });
  expect(assignment.email).toBe(email);
  expect(await db.competitionRegAssignmentAudit.count({ where: { competitionId: id } })).toBe(1);

  await page.context().clearCookies();
  await login(page, "comp");
  await page.goto("/comp");
  await expect(page.getByRole("heading", { name: "Your Reg chair" })).toBeVisible();
  await expect(page.getByRole("link", { name: email })).toBeVisible();
});
