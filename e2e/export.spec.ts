import { test } from "./helpers";
import { expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { competitionId, db, E2E, login, pageAs, SEALED_NAMES } from "./helpers";

const CSV = "/api/ops/export?dataset=teams&format=csv";
const XLSX = "/api/ops/export?dataset=teams&dataset=competitions&format=xlsx";

test("exports require a signed-in tech admin", async ({ page, request }) => {
  expect((await request.get(CSV)).status()).toBe(401);

  for (const role of ["team", "comp", "moderator", "judge"] as const) {
    await login(page, role);
    expect((await page.request.get(CSV)).status()).toBe(403);
    await page.context().clearCookies();
  }
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

  await page.goto("/ops/export");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator('input[name="dataset"]:checked')).toHaveCount(0);
  await page.getByRole("button", { name: "Everything" }).click();
  const allDatasets = await page.locator('input[name="dataset"]:checked').evaluateAll(
    (inputs) => inputs.map((input) => (input as HTMLInputElement).value),
  );
  expect(allDatasets).toHaveLength(8);
  const allQuery = new URLSearchParams({ format: "xlsx" });
  for (const dataset of allDatasets) allQuery.append("dataset", dataset);
  const allResponse = await page.request.get(`/api/ops/export?${allQuery}`);
  expect(allResponse.status()).toBe(200);
  const allWorkbook = new ExcelJS.Workbook();
  await allWorkbook.xlsx.load(new Uint8Array(await allResponse.body()).buffer);
  expect(allWorkbook.worksheets).toHaveLength(allDatasets.length);
  expect(allWorkbook.getWorksheet("Competition details")?.getRow(1).values).not.toContain("Applicant sheet");

  const tooMany = await page.request.get("/api/ops/export?dataset=teams&dataset=judges&format=csv");
  expect(tooMany.status()).toBe(400);
});

test("CSV and XLSX keep judging names sealed until results release", async ({ page }) => {
  const id = await competitionId(E2E.comps.showcase.slug);
  await login(page, "tech");
  await page.goto(`/ops/comps/${id}`);
  await page.getByRole("button", { name: "Open judging" }).click();
  await expect(page.getByText(/Judging is open\. The moderator can start/)).toBeVisible();
  const assignment = await db.judgeAssignment.findFirstOrThrow({ where: { competitionId: id }, include: { slots: true } });
  expect(assignment.slots).toHaveLength(2);
  for (const slot of assignment.slots) {
    await db.judgeScore.create({ data: { assignmentId: assignment.id, slotId: slot.id, choreography: 8, formations: 7, technique: 6, syncCleanliness: 5, overallImpression: 4 } });
  }
  await db.judgeAssignment.update({ where: { id: assignment.id }, data: { submittedAt: new Date() } });
  for (const released of [false, true]) {
    if (released) await db.competitionProfile.update({ where: { id }, data: { resultsReleasedAt: new Date() } });
    for (const dataset of ["scores", "results"]) {
      const csv = await page.request.get(`/api/ops/export?dataset=${dataset}&format=csv&competitionId=${id}`);
      expect(csv.status()).toBe(200);
      expect(csv.headers()["cache-control"]).toBe("no-store");
      const body = await csv.text();
      if (dataset === "scores" || released) expect(body).toContain(E2E.comps.showcase.name);
      for (const name of SEALED_NAMES) {
        if (released) expect(body).toContain(name);
        else expect(body).not.toContain(name);
      }
      if (!released && dataset === "scores") expect(body).toContain("Team 1");
      if (!released && dataset === "results") expect(body).not.toContain("Provisional");
    }
    const response = await page.request.get(`/api/ops/export?dataset=scores&dataset=results&format=xlsx&competitionId=${id}`);
    expect(response.status()).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(await response.body()).buffer);
    expect(workbook.worksheets).toHaveLength(2);
    const contents = JSON.stringify(workbook.worksheets.map((sheet) => sheet.getSheetValues()));
    expect(contents).toContain(E2E.comps.showcase.name);
    for (const name of SEALED_NAMES) {
      if (released) expect(contents).toContain(name);
      else expect(contents).not.toContain(name);
    }
    const lineup = await page.request.get(`/api/ops/export?dataset=lineups&format=csv&competitionId=${id}`);
    expect(lineup.status()).toBe(200);
    // Ops knows applicants, but must not get their anonymous viewing order.
    expect((await lineup.text()).includes("Sealed until release")).toBe(!released);
  }
});

test("competition director downloads ranked profiles, rosters, and scores only after finalization", async ({ browser, request }) => {
  const path = "/api/comp/applicants/export";
  const id = await competitionId(E2E.comps.showcase.slug);
  expect((await request.get(path)).status()).toBe(401);

  const director = await pageAs(browser, "comp");
  await director.goto("/comp/applicants");
  await expect(director.getByRole("link", { name: "Download final team workbook" })).toHaveCount(0);
  expect((await director.request.get(path)).status()).toBe(403);

  const team = await pageAs(browser, "team");
  expect((await team.request.get(path)).status()).toBe(403);

  // A release timestamp alone must not expose names while score packets are incomplete.
  await db.competitionProfile.update({ where: { id }, data: { resultsReleasedAt: new Date() } });
  expect((await director.request.get(path)).status()).toBe(403);
  await db.competitionProfile.update({ where: { id }, data: { resultsReleasedAt: null } });

  const tech = await pageAs(browser, "tech");
  await tech.goto(`/ops/comps/${id}`);
  await tech.getByRole("button", { name: "Open judging" }).click();
  await expect(tech.getByText(/Judging is open\. The moderator can start/)).toBeVisible();
  const assignment = await db.judgeAssignment.findFirstOrThrow({
    where: { competitionId: id },
    include: { slots: true },
  });
  expect(assignment.slots).toHaveLength(2);
  for (const slot of assignment.slots) {
    await db.judgeScore.create({
      data: { assignmentId: assignment.id, slotId: slot.id, choreography: 8, formations: 7, technique: 6, syncCleanliness: 5, overallImpression: 4 },
    });
  }
  await db.judgeAssignment.update({ where: { id: assignment.id }, data: { submittedAt: new Date() } });
  await tech.reload();
  await tech.getByRole("button", { name: "Validate Comp Results", exact: true }).click();
  await tech.getByRole("button", { name: "Yes, validate comp results" }).click();
  await expect(tech.getByText("Results finalized.")).toBeVisible();

  await director.goto("/comp/applicants");
  await expect(director.getByRole("link", { name: "Download final team workbook" })).toBeVisible();
  const response = await director.request.get(path);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(new Uint8Array(await response.body()).buffer);
  expect(workbook.worksheets).toHaveLength(4);
  expect(workbook.worksheets[0].name).toBe("Rankings");
  expect(workbook.worksheets.at(-1)?.name).toBe("Judge Scores");
  const contents = JSON.stringify(workbook.worksheets.map((sheet) => sheet.getSheetValues()));
  for (const name of SEALED_NAMES) expect(contents).toContain(name);
  expect(contents).toContain("Dancer One");
  expect(contents).toContain("drive.google.com");
  expect(contents).toContain("E2E Judge");
  expect(contents).not.toContain(E2E.teams.alpha.claimCode);
});
