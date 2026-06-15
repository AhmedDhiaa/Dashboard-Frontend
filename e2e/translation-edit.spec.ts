/**
 * E2E: admin edits a translation key via /admin/translations and the
 * change shows up live (the override file is read by /api/i18n/overrides
 * and merged into next-intl on the next render).
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

test("admin edits a translation key and the override persists", async ({ page }) => {
  test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to run authed e2e (admin role required)")
  await authenticate(page)
  await page.goto("/admin/translations")

  // The translation editor shows a key list; pick the first row's value
  // input and rewrite it.
  const valueInput = page.locator("input[data-testid^='translation-value']").first()
  await expect(valueInput).toBeVisible({ timeout: 10_000 })

  const newValue = `E2E ${Date.now()}`
  await valueInput.fill(newValue)
  await page
    .getByRole("button", { name: /save|publish/i })
    .first()
    .click()

  // Round-trip: refresh; the value should still be there.
  await page.reload()
  await expect(page.locator("input[data-testid^='translation-value']").first()).toHaveValue(newValue)
})
