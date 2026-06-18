/**
 * Establish the authenticated session ONCE (mock demo/demo) and persist it.
 * Every other functional spec reuses `e2e/.auth/user.json` via `storageState`.
 */

import { test as setup, expect } from "@playwright/test"

const AUTH_FILE = "e2e/.auth/user.json"

setup("authenticate via the mock demo login", async ({ page }) => {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" })

  // The auth fields render as <Input id="username"> / <Input id="password">
  // (no `name`); mock mode prefills demo/demo — set explicitly to be self-describing.
  await page.locator("#username").fill("demo", { timeout: 60_000 })
  await page.locator("#password").fill("demo")
  await page.locator("button[type='submit']").click()

  // Success = we leave the login page for a protected route.
  await page.waitForURL(url => !url.pathname.includes("/auth/login"), { timeout: 60_000 })
  await expect(page).not.toHaveURL(/\/auth\/login/)
  // Let the credentials-callback Set-Cookie settle before snapshotting — without
  // this wait the session cookie isn't yet in the context and storageState saves
  // an unauthenticated (cookie-less) state.
  await page.waitForLoadState("networkidle")

  const cookies = await page.context().cookies()
  expect(
    cookies.some(c => c.name.includes("session-token")),
    "NextAuth session-token cookie must be present before saving storage state",
  ).toBeTruthy()

  await page.context().storageState({ path: AUTH_FILE })
})
