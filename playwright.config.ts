import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Browser regression suite. Runs against a production build backed by a local
 * Postgres that the global setup wipes and re-seeds (see prisma/e2e-seed.ts).
 * Set DATABASE_URL, DIRECT_URL, and E2E_PASSWORD first; docs/workflows.md has
 * the full recipe.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `npx next start -p ${PORT}`
      : `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_URL: baseURL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-secret-not-for-production-use",
      AUTH_TRUST_HOST: "true",
    },
  },
});
