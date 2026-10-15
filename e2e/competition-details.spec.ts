import { expect } from "@playwright/test";
import { db, E2E, login, test } from "./helpers";

test("host details and Drive packet link survive saving and appear to teams", async ({ page, browser }) => {
  const competition = await db.competitionProfile.findUniqueOrThrow({ where: { slug: E2E.comps.showcase.slug } });
  await login(page, "comp");
  await page.goto("/comp/profile");
  await page.getByLabel("Event start date", { exact: true }).fill("2027-03-05");
  await page.getByLabel("Event end date", { exact: true }).fill("2027-03-07");
  await page.getByLabel("Regular application fee (USD per team)", { exact: true }).fill("35.29");
  await page.getByLabel("Late application fee (USD per team)", { exact: true }).fill("50");
  await page.getByLabel("Venue address", { exact: true }).fill("123 Example Street\nAtlanta, GA 30301");
  await page.getByLabel("Payment instructions", { exact: true }).fill("Pay https://example.com/payment. Include your team name. Regular fee through the early deadline; late fee after.");
  await page.getByLabel("AV guidelines *", { exact: true }).fill("Submit a 1080p MP4 with stereo audio.");
  await page.getByLabel("Competition bio *", { exact: true }).fill("A weekend celebrating dance.\nMeet teams from across the circuit.");
  await page.getByRole("button", { name: "Save Details", exact: true }).click();
  await expect(page.getByText(/Competition details saved/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Event start date", { exact: true })).toHaveValue("2027-03-05");
  await expect(page.getByLabel("Event end date", { exact: true })).toHaveValue("2027-03-07");
  await expect(page.getByLabel("Regular application fee (USD per team)", { exact: true })).toHaveValue("35.29");

  const packetUrl = "https://drive.google.com/file/d/1EvaXITNNCUf_u22R0gHwSxW7ytge3zaX/view";
  await page.getByLabel("Google Drive file link", { exact: true }).fill(`${packetUrl}?usp=sharing`);
  await page.getByRole("button", { name: "Save packet link", exact: true }).click();
  await expect(page.getByText("Application packet link saved.", { exact: true })).toBeVisible();

  const visitor = await browser.newPage({ timezoneId: "America/Los_Angeles" });
  try {
    await visitor.goto(`/comps/${competition.id}`);
    await expect(visitor.getByText(/Mar.*5.*7.*2027/)).toBeVisible();
    await expect(visitor.getByText("$35.29", { exact: true })).toBeVisible();
    await expect(visitor.getByText("$50.00", { exact: true })).toBeVisible();
    await expect(visitor.getByText("123 Example Street", { exact: false })).toBeVisible();
    await expect(visitor.getByText("Submit a 1080p MP4 with stereo audio.", { exact: true })).toBeVisible();
    await expect(visitor.getByText("A weekend celebrating dance.", { exact: false })).toBeVisible();
    await expect(visitor.getByText("Pay https://example.com/payment.", { exact: false })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Open application packet on Google Drive" })).toHaveAttribute("href", packetUrl);

    await page.getByLabel("Google Drive file link", { exact: true }).fill("https://example.com/packet.pdf");
    await page.getByRole("button", { name: "Save packet link", exact: true }).click();
    await expect(page.getByText("Enter a valid Google Drive file link.")).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole("link", { name: "Open application packet on Google Drive" })).toHaveAttribute("href", packetUrl);
    await page.getByRole("button", { name: "Remove packet", exact: true }).click();
    await expect(page.getByText("Application packet link removed.", { exact: true })).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole("link", { name: "Open application packet on Google Drive" })).toHaveCount(0);
    expect((await visitor.request.get(`/api/competitions/${competition.id}/packet`)).status()).toBe(404);
  } finally {
    await visitor.close();
  }
});
