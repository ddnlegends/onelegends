import { expect } from "@playwright/test";
import { test, db, E2E, competitionId, login, pageAs, SEALED_NAMES, ALL_CLAIM_CODES } from "./helpers";

test("live state refuses anonymous, team, and competition-admin callers", async ({ page, request }) => {
  const id = await competitionId(E2E.comps.showcase.slug);
  expect((await request.get(`/api/live/${id}`)).status()).toBe(401);
  for (const role of ["team", "comp"] as const) {
    await login(page, role);
    const response = await page.request.get(`/api/live/${id}`);
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "Not allowed." });
    await page.context().clearCookies();
  }
});

for (const role of ["moderator", "judge"] as const) {
  test(`${role} can read only assigned competitions, with anonymous fields`, async ({ page }) => {
    await login(page, role);
    const assigned = await competitionId(E2E.comps.showcase.slug);
    const other = await competitionId(E2E.comps.open.slug);
    expect((await page.request.get(`/api/live/${other}`)).status()).toBe(403);
    const response = await page.request.get(`/api/live/${assigned}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(["judgingOpen", "livePosition", "liveUpdatedAt"]);
    expect(body).toEqual({ judgingOpen: false, livePosition: null, liveUpdatedAt: null });
    for (const secret of [...SEALED_NAMES, ...ALL_CLAIM_CODES]) {
      expect(JSON.stringify(body)).not.toContain(secret);
    }
  });
}

test("non-partner admins get moderator controls while pending admins and judges do not", async ({ browser }) => {
  const id = await competitionId(E2E.comps.showcase.slug);
  const secondary = await db.user.findUniqueOrThrow({ where: { email: E2E.emails.team } });
  await db.competitionProfile.update({ where: { id }, data: { isPartner: false } });
  const membership = await db.competitionMembership.create({
    data: { competitionId: id, userId: secondary.id, status: "PENDING", isAdmin: true },
  });

  const comp = await pageAs(browser, "comp");
  const pending = await pageAs(browser, "team");
  const judge = await pageAs(browser, "judge");
  expect((await comp.request.get(`/api/live/${id}`)).status()).toBe(200);
  expect((await pending.request.get(`/api/live/${id}`)).status()).toBe(403);
  await expect(comp.getByRole("link", { name: /Open Live Viewing/ })).toBeVisible();
  await expect(pending.getByRole("link", { name: /Open Live Viewing/ })).toHaveCount(0);
  await pending.goto(`/moderator/${id}`);
  await expect(pending).toHaveURL(/\/dashboard$/);
  await judge.goto(`/moderator/${id}`);
  await expect(judge).toHaveURL(/\/dashboard$/);

  await db.competitionMembership.update({ where: { id: membership.id }, data: { status: "APPROVED" } });
  expect((await pending.request.get(`/api/live/${id}`)).status()).toBe(200);
  await pending.goto("/dashboard");
  await expect(pending.getByRole("link", { name: /Open Live Viewing/ })).toBeVisible();
  const ops = await pageAs(browser, "tech");
  await ops.goto(`/ops/comps/${id}`);
  await ops.getByRole("button", { name: "Open judging" }).click();

  await comp.goto(`/moderator/${id}`);
  await expect(comp.getByRole("heading", { name: "Ready when you are" })).toBeVisible();
  await comp.getByRole("button", { name: "Show Team 1" }).click();
  await expect(comp.getByRole("heading", { name: "Team 1" })).toBeVisible();
  for (const secret of [...SEALED_NAMES, ...ALL_CLAIM_CODES]) {
    expect(await comp.content()).not.toContain(secret);
  }
  const live = await judge.request.get(`/api/live/${id}`);
  expect((await live.json()).livePosition).toBe(1);

  await db.competitionMembership.delete({ where: { id: membership.id } });
  expect((await pending.request.get(`/api/live/${id}`)).status()).toBe(403);
  await db.competitionProfile.update({ where: { id }, data: { isPartner: true } });
  expect((await comp.request.get(`/api/live/${id}`)).status()).toBe(403);
});
