/**
 * Shared helpers for the functional suite. Not a spec (no `.spec`/`.test`), so
 * Playwright never collects it as a test file.
 */

import path from "path"
import type { Page } from "@playwright/test"

/** Arabic "page not found" copy from the not-found boundary. */
export const NOT_FOUND_TEXT = "الصفحة غير موجودة"

/** axe-core ships a standalone bundle; inject it from node_modules (no extra dep). */
const AXE_SOURCE = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js")

/**
 * Discover the app's internal routes from the LIVE sidebar navigation — the
 * single source of truth — so the gates stay generic: any project/backend built
 * on this template is covered with no test edits. Excludes hash links, the
 * public `/auth/*` surface, and query strings.
 */
export async function discoverRoutes(page: Page): Promise<string[]> {
  const hrefs = await page.locator("nav a[href^='/']").evaluateAll(els => els.map(el => el.getAttribute("href") ?? ""))
  const seen = new Set<string>()
  for (const href of hrefs) {
    if (!href.startsWith("/") || href.includes("#") || href.startsWith("/auth")) continue
    seen.add(href.split("?")[0])
  }
  return [...seen]
}

export type AxeFinding = { id: string; impact: string | null; nodes: number }

/** Run axe (WCAG 2 A/AA) against the current page and return the violations. */
export async function axeViolations(page: Page): Promise<AxeFinding[]> {
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
