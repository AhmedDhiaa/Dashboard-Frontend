import { test, expect } from "@playwright/test"
import { discoverProductRoutes, NOT_FOUND_TEXT } from "./_helpers"

/**
 * Dynamic navigation gate. Discovers every internal link from the LIVE sidebar
 * navigation and asserts each is reachable while authenticated: the session is
 * held (no login bounce), the authenticated shell renders (`#main-content` only
 * exists inside the dashboard layout), and it is a real route — not the
 * not-found boundary. Add a nav item and it's covered with no test edit.
 */
test("every sidebar route is reachable, authenticated, and not a 404", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.locator("#main-content").first().waitFor({ state: "visible", timeout: 45_000 })

  const routes = await discoverProductRoutes(page)
  expect(routes.length, "expected the sidebar nav to expose several routes").toBeGreaterThan(3)

  for (const route of routes) {
    await test.step(`renders ${route}`, async () => {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await expect(page, `${route} should not bounce to login`).not.toHaveURL(/\/auth\/login/)
      const main = page.locator("#main-content")
      await expect(main, `${route} authenticated shell should render`).toBeVisible({ timeout: 45_000 })
      await expect(main, `${route} should not be the not-found page`).not.toContainText(NOT_FOUND_TEXT)
    })
  }
})
