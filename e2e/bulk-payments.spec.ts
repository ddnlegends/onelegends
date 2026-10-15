import { expect } from "@playwright/test";
import { test, db, E2E, login } from "./helpers";

test("tech admin can confirm Mark All Paid from payment tracking", async ({ page }) => {
  const team = await db.teamProfile.findUniqueOrThrow({ where: { slug: E2E.teams.alpha.slug } });
  const competition = await db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const hostPayment = await db.application.findFirstOrThrow({ select: { id: true, compPaymentReceivedAt: true } });
  await db.$transaction([
    db.teamProfile.update({ where: { id: team.id }, data: { registrationPaidAt: null } }),
    db.competitionProfile.update({ where: { id: competition.id }, data: { registrationPaidAt: null } }),
  ]);

  await login(page, "tech");
  await page.goto("/ops/payments");
  await expect(page.getByRole("button", { name: "Mark All Paid" })).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Mark All Paid" }).click();
  await expect(page.getByText(/Marked \d+ teams? and \d+ competitions? paid\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark All Paid" })).toBeDisabled();

  expect(await db.teamProfile.count({ where: { registrationPaidAt: null } })).toBe(0);
  expect(await db.competitionProfile.count({ where: { registrationPaidAt: null } })).toBe(0);
  expect(await db.application.findUniqueOrThrow({ where: { id: hostPayment.id } })).toMatchObject({
    compPaymentReceivedAt: hostPayment.compPaymentReceivedAt,
  });
});
