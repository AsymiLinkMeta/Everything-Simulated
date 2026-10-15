import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the local stack (see local/README.md):
 *   local/stack.sh up && local/migrate.sh && local/seed.sh
 *   deno run -A --node-modules-dir=none local/gateway.ts &
 *   npm run e2e
 * The web server is started by Playwright with the local API env.
 */
const PORT = Number(process.env.E2E_PORT ?? 5173);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/.results",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "e2e/.report", open: "never" }], ["json", { outputFile: "e2e/.report/results.json" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: true,
        env: {
          VITE_SUPABASE_URL: process.env.LOCAL_API_URL ?? "http://localhost:54321",
          VITE_SUPABASE_ANON_KEY: process.env.LOCAL_ANON_KEY ?? "",
          VITE_SITE_URL: baseURL,
          VITE_NOINDEX: "true",
        },
      },
});
