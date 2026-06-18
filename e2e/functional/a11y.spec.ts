import { test, expect } from "@playwright/test"
import { discoverProductRoutes, axeViolations } from "./_helpers"

/**
 * Dynamic accessibility gate. Scans EVERY live sidebar route (discovered at
 * runtime, not hard-coded) with axe-core — the dashboard chrome, data lists, and
 * the builders — coverage the jsdom unit axe tests can't provide.
 *
 * Gate: zero `critical` AND zero `serious` WCAG 2 A/AA violations on any route.
 * (`moderate`/`minor` are surfaced per-route in the run log to ratchet down.)
 * The theme palette + component fixes brought every route to this bar.
 */
test("no critical/serious axe violations on any sidebar route", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.locator("#main-content").first().waitFor({ state: "visible", timeout: 45_000 })

  const routes = await discoverProductRoutes(page)
  expect(routes.length, "expected the sidebar nav to expose several routes").toBeGreaterThan(3)

  for (const route of routes) {
    await test.step(`axe ${route}`, async () => {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await page.locator("#main-content").first().waitFor({ state: "visible", timeout: 45_000 })

      const violations = await axeViolations(page)
      const blocking = violations.filter(v => v.impact === "critical" || v.impact === "serious")
      const tracked = violations.filter(v => v.impact !== "critical" && v.impact !== "serious")
      if (tracked.length) console.log(`[a11y:${route}] moderate/minor (tracked):`, JSON.stringify(tracked))

      expect(blocking, `critical/serious axe violations on ${route}: ${JSON.stringify(blocking)}`).toHaveLength(0)
    })
  }
})
