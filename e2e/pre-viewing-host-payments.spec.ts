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
  await expect(applicationsPanel.getByRole("listitem").filter({ hasText: paid.team.name })).toContainText("Host payment: Received");
  await expect(applicationsPanel.getByRole("listitem").filter({ hasText: unpaid.team.name })).toContainText("Host payment: Not marked paid");

  await tech.goto("/ops/payments");
  const paymentsPanel = tech.locator("section").filter({ has: tech.getByRole("heading", { name: "Applicants · host payments" }) });
  await expect(paymentsPanel.getByRole("listitem").filter({ hasText: paid.team.name })).toContainText("Received");
  await expect(paymentsPanel.getByRole("listitem").filter({ hasText: unpaid.team.name })).toContainText("Not marked paid");
  expect((await db.application.findUniqueOrThrow({ where: { id: unpaid.id } })).compPaymentReceivedAt).toBeNull();
});
