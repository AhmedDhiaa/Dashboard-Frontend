/**
 * E2E: locale switch flips dir + persists across navigation.
 *
 * The locale selector lives in /settings/language. Selecting Arabic
 * sets the NEXT_LOCALE cookie and reloads; we then verify the document
 * is in dir="rtl" and that the cookie persisted on a fresh navigation.
 */

import { test, expect, type Page } from "@playwright/test"

const SESSION_COOKIE = process.env.APP_E2E_AUTH_COOKIE
const SESSION_COOKIE_NAME = process.env.APP_E2E_AUTH_COOKIE_NAME ?? "authjs.session-token"
const BASE_URL = process.env.APP_E2E_BASE_URL ?? "http://localhost:3000"

async function authenticate(page: Page): Promise<void> {
  if (!SESSION_COOKIE) return
  const url = new URL(BASE_URL)
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: SESSION_COOKIE,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ])
}

test("switching to Arabic flips the document direction", async ({ page }) => {
  test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to run")
  await authenticate(page)
  await page.goto("/settings/language")

  // The language picker is a button group / radio set — pick the Arabic
  // option by visible text or aria-label.
  const arabic = page.getByRole("button", { name: /arabic|العربية/i }).first()
  await arabic.click()

  await page.waitForLoadState("networkidle")
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")

  // Persistence: navigate elsewhere, dir stays rtl.
  await page.goto("/dashboard")
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
})
