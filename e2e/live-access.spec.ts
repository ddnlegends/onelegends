import { expect } from "@playwright/test";
import { test, E2E, competitionId, login, SEALED_NAMES, ALL_CLAIM_CODES } from "./helpers";

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

for (const role of ["reg", "judge"] as const) {
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
