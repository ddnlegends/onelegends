import { expect, test } from "@playwright/test";
import { E2E, login } from "./helpers";

const CSV = "/api/ops/export?dataset=teams&format=csv";
const XLSX = "/api/ops/export?dataset=teams&dataset=competitions&format=xlsx";

test("exports require a signed-in tech admin", async ({ page, request }) => {
  expect((await request.get(CSV)).status()).toBe(401);

  await login(page, "team");
  expect((await page.request.get(CSV)).status()).toBe(403);
});

test("a tech admin downloads CSV and xlsx", async ({ page }) => {
  await login(page, "tech");

  const csv = await page.request.get(CSV);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["content-disposition"]).toContain(".csv");
  expect(await csv.text()).toContain(E2E.teams.alpha.name);

  const xlsx = await page.request.get(XLSX);
  expect(xlsx.status()).toBe(200);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  const body = await xlsx.body();
  expect(body.subarray(0, 2).toString()).toBe("PK");

  const tooMany = await page.request.get("/api/ops/export?dataset=teams&dataset=judges&format=csv");
  expect(tooMany.status()).toBe(400);
});
