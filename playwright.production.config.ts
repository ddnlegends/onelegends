import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Reuse the build, never the test-enabled server. Verify the server boundary.
export default defineConfig({
  ...base,
  testDir: "./e2e-production",
  outputDir: "test-results-production",
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-production" }]] : "list",
  projects: [{ name: "production-auth", use: { ...devices["Desktop Chrome"] } }],
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  webServer: {
    command: "npx next start -p 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    env: {
      AUTH_URL: "http://127.0.0.1:3101",
      AUTH_SECRET: "e2e-only-secret-not-for-production-use",
      // Even an accidental opt-in must not enable passwords on Vercel.
      AUTH_ENABLE_TEST_LOGIN: "true",
      VERCEL: "1",
      VERCEL_ENV: "production",
      AUTH_TRUST_HOST: "true",
    },
  },
});
