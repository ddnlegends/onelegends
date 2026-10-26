import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E, seedE2E } from "../prisma/e2e-seed";

export { E2E };

const roleContexts = new Set<BrowserContext>();

// Each test/retry starts from known data. One worker per isolated database.
export const test = base.extend<{ fixtureDatabase: void }>({
  fixtureDatabase: [async ({}, runTest) => {
    await seedE2E();
    try {
      await runTest();
    } finally {
      await Promise.all([...roleContexts].map((context) => context.close()));
      roleContexts.clear();
    }
  }, { auto: true }],
});

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
  roleContexts.add(context);
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

/** Prepare a playable local AV with an identifying filename, then enter the safe viewer. */
export async function prepareAnonymousVideos(page: Page) {
  const fixture = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    canvas.getContext("2d")!.fillRect(0, 0, 16, 16);
    const stream = canvas.captureStream(10);
    const mimeType = ["video/webm;codecs=vp8", "video/webm", "video/mp4"]
      .find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("The test browser cannot record a video fixture.");
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    const finished = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 500));
    recorder.stop();
    const blob = await finished;
    stream.getTracks().forEach((track) => track.stop());
    return { mimeType, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  });
  await page.getByRole("button", { name: "Prepare videos privately" }).click();
  const selectors = page.getByLabel(/^Select local video for Team /);
  const count = await selectors.count();
  for (let index = 0; index < count; index++) {
    await selectors.nth(index).setInputFiles({
      name: `Identifying Team Name audition.${fixture.mimeType.includes("mp4") ? "mp4" : "webm"}`,
      mimeType: fixture.mimeType,
      buffer: Buffer.from(fixture.bytes),
    });
  }
  await expect(page.getByRole("button", { name: "Begin anonymous viewing" })).toBeEnabled();
  await page.getByRole("button", { name: "Begin anonymous viewing" }).click();
  await expect(page.locator("iframe[src*='drive.google.com']")).toHaveCount(0);
  expect(await page.content()).not.toContain("Identifying Team Name");
}

export const ALL_CLAIM_CODES = [
  ...Object.values(E2E.teams).map((team) => team.claimCode),
  ...Object.values(E2E.comps).map((comp) => comp.claimCode),
];
