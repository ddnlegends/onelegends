import { expect, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E } from "../prisma/e2e-seed";

export { E2E };

export type Role = keyof typeof E2E.emails;

export const db = new PrismaClient();

export function password(): string {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("Set E2E_PASSWORD to run the e2e suite.");
  return value;
}

export async function login(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByText("Existing test account login").click();
  await page.locator("#test-email").fill(E2E.emails[role]);
  await page.locator("#test-password").fill(password());
  await page.getByRole("button", { name: "Sign in to test account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** A separate browser context per role, so several people can be signed in at once. */
export async function pageAs(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, role);
  return page;
}

export async function competitionId(slug: string): Promise<string> {
  const row = await db.competitionProfile.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });
  return row.id;
}

export const SEALED_NAMES = [E2E.teams.alpha.name, E2E.teams.beta.name];

export const ALL_CLAIM_CODES = [
  ...Object.values(E2E.teams).map((team) => team.claimCode),
  ...Object.values(E2E.comps).map((comp) => comp.claimCode),
];
