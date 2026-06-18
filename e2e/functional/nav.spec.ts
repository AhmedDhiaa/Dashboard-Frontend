import { test, expect } from "@playwright/test"

/**
 * Every core sidebar route must be reachable while authenticated: the session is
 * held (no login bounce), the authenticated shell renders (`#main-content` only
 * exists inside the dashboard layout, never on the login page), and it is a real
 * route — not the not-found boundary.
 *
 * This guards routing + auth + build integrity across the app's main surfaces.
 * Deep per-widget content is asserted on the dashboard in `smoke.spec.ts`.
 */
const ROUTES = ["/", "/users", "/roles", "/tickets", "/notifications", "/example"] as const
const NOT_FOUND_TEXT = "الصفحة غير موجودة"

test.describe("navigation (authenticated)", () => {
  for (const route of ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await expect(page, `${route} should not bounce to login`).not.toHaveURL(/\/auth\/login/)

      const main = page.locator("#main-content")
      await expect(main, `${route} authenticated shell should render`).toBeVisible({ timeout: 45_000 })
      await expect(main, `${route} should not be the not-found page`).not.toContainText(NOT_FOUND_TEXT)
    })
  }
})
