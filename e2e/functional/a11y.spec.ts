import path from "path"
import { test, expect } from "@playwright/test"

/**
 * Accessibility scan of the *live* authenticated pages — the dashboard chrome
 * (sidebar, banner, command palette) and a data list — which the jsdom unit axe
 * tests (auth pages + isolated primitives) can't exercise. axe-core is injected
 * from node_modules, so no extra dependency is needed.
 *
 * Gate: zero `critical` WCAG 2 A/AA violations (the must-never tier). Lower
 * impacts (`serious`/`moderate`/`minor`) are surfaced in the run log for the
 * team to ratchet down — mirroring the codebase's narrow-but-sharp coverage
 * gate. The live dashboard currently carries two `serious` findings
 * (`color-contrast`, `document-title`) tracked this way until fixed.
 */

const AXE_SOURCE = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js")

type AxeFinding = { id: string; impact: string | null; nodes: number }

async function axeViolations(page: import("@playwright/test").Page): Promise<AxeFinding[]> {
  await page.addScriptTag({ path: AXE_SOURCE })
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            ctx: Document,
            opts: unknown,
          ) => Promise<{ violations: Array<{ id: string; impact: string | null; nodes: unknown[] }> }>
        }
      }
    ).axe
    const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } })
    return res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
  })
}

const PAGES = [
  { name: "dashboard", path: "/" },
  { name: "users list", path: "/users" },
] as const

test.describe("a11y (axe — live authenticated pages)", () => {
  for (const p of PAGES) {
    test(`${p.name} has no critical axe violations`, async ({ page }) => {
      await page.goto(p.path, { waitUntil: "domcontentloaded" })
      await page.locator("#main-content").first().waitFor({ state: "visible", timeout: 45_000 })

      const violations = await axeViolations(page)
      const critical = violations.filter(v => v.impact === "critical")
      const tracked = violations.filter(v => v.impact !== "critical")
      if (tracked.length) console.log(`[a11y:${p.name}] non-critical (tracked):`, JSON.stringify(tracked))

      expect(critical, `critical axe violations on ${p.name}: ${JSON.stringify(critical)}`).toHaveLength(0)
    })
  }
})
