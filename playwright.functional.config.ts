/**
 * Playwright config — FUNCTIONAL e2e against a standalone MOCK server.
 *
 * Distinct from `playwright.config.ts` (the RTL screenshot suite): this one
 * SPAWNS the app in mock mode (`NEXT_PUBLIC_USE_MOCK_API=true`, seeded data, no
 * backend) and drives real user flows — login, navigation, CRUD, permissions —
 * end to end. It is the CI gate for "the app actually works".
 *
 * Auth is established ONCE by `auth.setup.ts` (logs in as demo/demo) and saved
 * to `e2e/.auth/user.json`; every other spec reuses that storage state.
 */

import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.APP_E2E_PORT ?? 3100)
const BASE_URL = `http://localhost:${PORT}`
const AUTH_FILE = "e2e/.auth/user.json"

// A throwaway, deterministic secret — only ever signs the offline demo session.
const E2E_AUTH_SECRET = "e2e-mock-secret-deterministic-at-least-32-chars"

export default defineConfig({
  testDir: "./e2e/functional",
  // Auth state is shared via a file; keep specs serial to avoid cross-talk on
  // the single in-memory mock store.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Dev-server first-compile (under route warmup) can be slow per route.
  timeout: 120_000,

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: {
    // APP_E2E_PROD=1 serves the production STANDALONE build (pre-built chunks,
    // the artifact that ships) via `e2e:prod:build` + the serve script; otherwise
    // the dev server. Prod mode is deterministic — no on-demand compile.
    command: process.env.APP_E2E_PROD ? "node scripts/e2e-prod-serve.mjs" : "npm run dev",
    // Wait for the LOGIN route itself to compile + respond, so the dev server's
    // cold first-compile happens during startup (240s budget) rather than inside
    // the auth.setup test — that was the source of flakiness.
    url: `${BASE_URL}/auth/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      // Skip the dev route-warmer so it doesn't contend with on-demand compiles.
      APP_DEV_WARMUP: "false",
      NEXT_PUBLIC_USE_MOCK_API: "true",
      NEXT_PUBLIC_API_URL: BASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
      NEXTAUTH_SECRET: E2E_AUTH_SECRET,
      NEXTAUTH_URL: BASE_URL,
      AUTH_URL: BASE_URL,
      AUTH_TRUST_HOST: "true",
      NEXT_PUBLIC_APP_NAME: "Acme",
      NEXT_PUBLIC_BRAND_DOMAIN: "example.com",
    },
  },
})
