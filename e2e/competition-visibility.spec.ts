import { expect } from "@playwright/test";
import { db, E2E, login, pageAs, test } from "./helpers";

test("competition stays hidden until its host fills every required detail", async ({ page, browser }) => {
  const competition = await db.competitionProfile.update({
    where: { slug: E2E.comps.showcase.slug },
    data: { stageSize: "", acceptingApps: true, applicationDeadline: null },
  });
  const publicPage = await browser.newPage();
  try {
    await publicPage.goto("/");
    await expect(publicPage.getByText(E2E.comps.showcase.name)).toHaveCount(0);
    await publicPage.goto(`/comps/${competition.id}`);
    await expect(publicPage.getByText("404", { exact: true })).toBeVisible();

    await login(page, "team");
    await page.goto("/team/apply");
    await expect(page.getByText(E2E.comps.showcase.name)).toHaveCount(0);

    const hostPage = await pageAs(browser, "comp");
    await hostPage.goto("/dashboard");
    await expect(hostPage.getByText(/hidden from teams until Comp Details is complete/)).toBeVisible();
    await hostPage.goto("/comp/profile");
    await expect(hostPage.getByText(/Still needed: Stage size/)).toBeVisible();
    await hostPage.getByLabel(/Stage size \/ dimensions/).fill("N/A");
    await hostPage.getByLabel("Accepting Applications").check();
    await hostPage.getByRole("button", { name: "Save Details" }).click();
    await expect(hostPage.getByText(/listing is visible and applications are open/)).toBeVisible();

    await publicPage.goto("/");
    await expect(publicPage.getByText(E2E.comps.showcase.name)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: E2E.comps.showcase.name })).toBeVisible();
  } finally {
    await publicPage.close();
  }
});
