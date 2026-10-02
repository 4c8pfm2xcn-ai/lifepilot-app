import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

/**
 * Unit tests run in Node via the Playwright runner (no browser).
 * E2E tests run against a production build (`npm run build` first) in demo
 * mode — no Supabase/Anthropic credentials are needed.
 */
export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", launchOptions: { executablePath } },
  projects: [
    { name: "unit", testDir: "tests/unit" },
    { name: "desktop", testDir: "tests/e2e", testIgnore: /mobile\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 }, launchOptions: { executablePath } } },
    { name: "mobile", testDir: "tests/e2e", testMatch: /mobile\.spec/, use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/ai/status`,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", ANTHROPIC_API_KEY: "" },
  },
});
