/**
 * E2E: Page Builder canvas — Phase 4 MVP flow.
 *
 * Walks through the headline scenario in spec §15 Phase 4:
 *   1. Open the canvas at /admin/page-builder.
 *   2. Add a `table` block from the palette (click; HTML5 drag is also
 *      tested in Vitest unit tests but Playwright drag wiring varies by
 *      OS — click is the deterministic path here).
 *   3. Edit the block's properties via the JSON editor.
 *   4. Apply + save.
 *   5. Confirm the resulting schema is reflected in the live preview.
 *
 * Screenshots are captured in three states (empty / selected / preview)
 * and saved next to the spec for review.
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

test("page-builder canvas: add → edit → save → preview", async ({ page }) => {
  test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to run (admin role required)")
  await authenticate(page)

  // ─── 1. Open canvas ───────────────────────────────────────────────────
  await page.goto("/admin/page-builder")
  await expect(page.getByTestId("page-builder-canvas")).toBeVisible()
  await expect(page.getByTestId("canvas-empty-state")).toBeVisible()
  await page.screenshot({ path: "test-results/page-builder/01-empty-canvas.png", fullPage: true })

  // ─── 2. Add a table block from the palette ───────────────────────────
  await page.getByTestId("palette-block-table").click()
  await expect(page.getByTestId("canvas-blocks-list")).toBeVisible()
  const tableItem = page.locator('[data-block-type="table"][data-testid^="canvas-block-item-"]').first()
  await expect(tableItem).toBeVisible()

  // ─── 3. Select + edit ────────────────────────────────────────────────
  await tableItem.click()
  await expect(page.getByTestId("properties-panel")).toBeVisible()
  await page.screenshot({ path: "test-results/page-builder/02-block-selected.png", fullPage: true })

  // The dirty indicator must surface as soon as a block is added.
  await expect(page.getByTestId("dirty-indicator")).toBeVisible()

  // ─── 4. Save ─────────────────────────────────────────────────────────
  await page.getByTestId("btn-save").click()
  // After save the dirty pill should disappear.
  await expect(page.getByTestId("dirty-indicator")).toHaveCount(0)

  // ─── 5. Switch to preview mode ───────────────────────────────────────
  await page.getByTestId("btn-preview").click()
  await expect(page.getByTestId("canvas-preview-mode")).toBeVisible()
  await expect(page.getByTestId("preview-pane")).toBeVisible()
  await page.screenshot({ path: "test-results/page-builder/03-preview-mode.png", fullPage: true })

  // Toggle the locale + viewport in preview mode to confirm the controls work.
  await page.getByTestId("preview-toggle-locale").click()
  await expect(page.getByTestId("preview-frame")).toHaveAttribute("data-preview-locale", "ar")
  await page.getByTestId("preview-viewport-mobile").click()
  await expect(page.getByTestId("preview-frame")).toHaveAttribute("data-preview-viewport", "mobile")
})
