/**
 * Playwright config — RTL screenshot suite.
 *
 * Why a tiny config (one project, one browser):
 *   The suite's job is to catch RTL layout regressions on a small handful
 *   of canonical pages (dashboard, sidebar, list, edit). It is *not* a
 *   full cross-browser e2e harness — that lives elsewhere. Keeping this
 *   minimal makes the failure signal obvious: if a screenshot diff appears
 *   in a PR, an admin tweaked layout in a way that doesn't survive RTL.
 *
 * Snapshots live next to the spec under `e2e/__screenshots__/<spec>/`.
 * Run `npm run test:e2e:rtl:update` to refresh baselines after an
 * intentional UI change.
 *
 * Auth: real auth is awkward to script. The suite reads two env vars:
 *   - APP_E2E_BASE_URL    (default http://localhost:3000)
 *   - APP_E2E_AUTH_COOKIE (NextAuth `authjs.session-token` cookie value)
 * If APP_E2E_AUTH_COOKIE isn't set, auth-protected screenshots
 * gracefully skip — the suite still asserts on the public surfaces.
 */

import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.APP_E2E_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e",
  // RTL screenshot diffs are deterministic; one retry covers transient
  // layout-shift / animation timing.
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    locale: "ar",
    // Pin the viewport so screenshots are stable across machines.
    viewport: { width: 1440, height: 900 },
    // Force the Arabic locale via the cookie the i18n middleware reads.
    storageState: undefined,
    extraHTTPHeaders: { "Accept-Language": "ar" },
    trace: "retain-on-failure",
  },

  // 1px diff tolerance + 1% mismatched-pixel allowance keeps anti-aliasing
  // jitter from triggering false failures across CI runners.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    },
  },

  projects: [
    {
      name: "chromium-rtl",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
