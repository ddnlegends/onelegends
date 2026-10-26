import { expect } from "@playwright/test";
import { db, E2E, pageAs, test } from "./helpers";

test("tech admins see each applicant's host payment before AV viewing", async ({ browser }) => {
  const competition = await db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const applications = await db.application.findMany({
    where: { competitionId: competition.id },
    include: { team: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const [paid, unpaid] = applications;
  await db.application.updateMany({
    where: { id: { in: [paid.id, unpaid.id] } },
    data: { compPaymentReceivedAt: null, compPaymentRecordedByEmail: null },
  });
  expect(competition.resultsReleasedAt).toBeNull();
  expect(competition.judgingOpen).toBe(false);

  const host = await pageAs(browser, "comp");
  await host.goto("/comp/applicants");
  const hostRow = host.getByRole("listitem").filter({ hasText: paid.team.name });
  await hostRow.getByRole("checkbox", { name: "Payment received" }).check();
  await expect.poll(async () => db.application.findUniqueOrThrow({ where: { id: paid.id } }))
    .toMatchObject({ compPaymentReceivedAt: expect.any(Date) });

  const tech = await pageAs(browser, "tech");
  await tech.goto("/ops/competitions");
  const competitionRow = tech.locator("article").filter({ hasText: competition.name });
  await competitionRow.locator("button[aria-expanded]").click();
  const applicationsPanel = competitionRow.locator("section").filter({ has: tech.getByRole("heading", { name: "Applications" }) });
  await expect(applicationsPanel.getByRole("listitem").filter({ hasText: paid.team.name })).toContainText("Host payment: Paid for comp");
  await expect(applicationsPanel.getByRole("listitem").filter({ hasText: unpaid.team.name })).toContainText("Host payment: Unpaid for comp");

  await tech.goto("/ops/payments");
  const paymentsPanel = tech.locator("section").filter({ has: tech.getByRole("heading", { name: "Applicants · host payments" }) });
  await expect(paymentsPanel.getByRole("listitem").filter({ hasText: paid.team.name })).toContainText("Received");
  await expect(paymentsPanel.getByRole("listitem").filter({ hasText: unpaid.team.name })).toContainText("Not marked paid");
  expect((await db.application.findUniqueOrThrow({ where: { id: unpaid.id } })).compPaymentReceivedAt).toBeNull();
});

test("host and tech admins can close the payment review and return before viewing", async ({ browser }) => {
  const competition = await db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  const application = await db.application.findFirstOrThrow({ where: { competitionId: competition.id }, include: { team: true } });
  const host = await pageAs(browser, "comp");
  await host.goto("/comp/applicants");
  await expect(host.getByText("Teams not marked paid to your competition will be excluded from AV viewing.")).toBeVisible();
  await host.getByRole("button", { name: "Review host payments" }).click();
  await expect(host.getByRole("dialog", { name: "Verify host payments" })).toBeVisible();
  await host.getByRole("button", { name: "Close payment review" }).click();
  await expect(host.getByRole("dialog", { name: "Verify host payments" })).toHaveCount(0);

  await host.getByRole("listitem").filter({ hasText: application.team.name }).getByRole("checkbox", { name: "Payment received" }).uncheck();
  await expect.poll(async () => (await db.application.findUniqueOrThrow({ where: { id: application.id } })).compPaymentReceivedAt).toBeNull();
  await host.getByRole("button", { name: "Review host payments" }).click();
  const dialog = host.getByRole("dialog", { name: "Verify host payments" });
  await expect(dialog.getByRole("listitem").filter({ hasText: application.team.name })).toContainText("Unpaid for comp");
  await dialog.getByRole("button", { name: "Done reviewing" }).click();

  const tech = await pageAs(browser, "tech");
  await tech.goto(`/ops/comps/${competition.id}`);
  await expect(tech.getByRole("heading", { name: "Applicant host payments" })).toBeVisible();
  await expect(tech.getByRole("listitem").filter({ hasText: application.team.name })).toContainText("Unpaid for comp");
  await expect(tech.getByRole("checkbox", { name: "Payment received" })).toHaveCount(0);
  await tech.getByRole("button", { name: "Open judging" }).click();
  const techReview = tech.getByRole("dialog", { name: "Verify host payments before viewing" });
  await expect(techReview.getByRole("listitem").filter({ hasText: application.team.name })).toContainText("Unpaid for comp");
  await techReview.getByRole("button", { name: "Close payment verification" }).click();
  expect((await db.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } })).judgingOpen).toBe(false);
  await tech.getByRole("button", { name: "Open judging" }).click();
  await tech.getByRole("button", { name: "Confirm and open judging" }).click();
  await expect.poll(async () => (await db.competitionProfile.findUniqueOrThrow({ where: { id: competition.id } })).judgingOpen).toBe(true);
  expect((await db.application.findUniqueOrThrow({ where: { id: application.id } })).viewingPosition).toBeNull();
});
