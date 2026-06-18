import { test, expect } from "@playwright/test"
import { discoverRoutes, axeViolations } from "./_helpers"

/**
 * Dynamic accessibility gate. Scans EVERY live sidebar route (discovered at
 * runtime, not hard-coded) with axe-core — the dashboard chrome, data lists, and
 * the builders — coverage the jsdom unit axe tests can't provide.
 *
 * Gate: zero `critical` WCAG 2 A/AA violations on any route (the must-never
 * tier). Lower impacts (`serious`/`moderate`/`minor`) are surfaced per-route in
 * the run log to ratchet down — mirroring the codebase's narrow-but-sharp
 * coverage gate.
 */
test("no critical axe violations on any sidebar route", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.locator("#main-content").first().waitFor({ state: "visible", timeout: 45_000 })

  const routes = await discoverRoutes(page)
  expect(routes.length, "expected the sidebar nav to expose several routes").toBeGreaterThan(3)

  for (const route of routes) {
    await test.step(`axe ${route}`, async () => {
      await page.goto(route, { waitUntil: "domcontentloaded" })
      await page.locator("#main-content").first().waitFor({ state: "visible", timeout: 45_000 })

      const violations = await axeViolations(page)
      const critical = violations.filter(v => v.impact === "critical")
      const tracked = violations.filter(v => v.impact !== "critical")
      if (tracked.length) console.log(`[a11y:${route}] non-critical (tracked):`, JSON.stringify(tracked))

      expect(critical, `critical axe violations on ${route}: ${JSON.stringify(critical)}`).toHaveLength(0)
    })
  }
})
