import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for BugBoard.
 *
 * Requires a running MySQL that DATABASE_URL points at. globalSetup applies
 * migrations and reseeds so specs start from known demo data — the seed refuses
 * to run against NODE_ENV=production (prisma/seed.ts), so this cannot clobber a
 * real database by accident, but it WILL reset your local dev data.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // specs share one DB and mutate issues; keep them serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
