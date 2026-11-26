import { defineConfig, devices } from "@playwright/test";

/**
 * E2E. By default builds nothing: run `npm run build` first; Playwright seeds a
 * fresh e2e DB and starts `next start`. Set E2E_BASE_URL to reuse a running server.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "src/qa/e2e-results.json" }]],
  use: { baseURL: external ?? `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: external
    ? undefined
    : {
        command: `npm run seed && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: { DATABASE_PATH: "./data/e2e.db", DATA_KEY: "e2e-test-key-not-secret-0123456789abcdef", SEED_RESET: "1", ALLOW_DEV_KEY: "1" },
      },
});
