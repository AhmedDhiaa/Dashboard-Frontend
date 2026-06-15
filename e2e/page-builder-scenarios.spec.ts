/**
 * Page Builder — five-scenario acceptance suite (per spec §16).
 *
 * Every test follows the same skip-without-cookie + admin-auth pattern as
 * `page-builder-canvas.spec.ts` (Phase 4). Run with:
 *   APP_E2E_AUTH_COOKIE=<admin-session> npm run test:e2e:rtl
 *
 * Data-testid hooks are stable across phases (canvas + palette + properties
 * panel were locked down in Phase 4); these specs lean on them rather
 * than visual locators so the suite tolerates copy edits.
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

test.describe("Page Builder §16 acceptance scenarios", () => {
  test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to run (admin role required)")

  test.beforeEach(async ({ page }) => {
    await authenticate(page)
  })

  // ─── Scenario 1 — CRUD page from Swagger (Orders) ─────────────────────
  test("scenario 1 — generate a CRUD page from a Swagger cluster", async ({ page }) => {
    await page.goto("/admin/page-builder")
    await expect(page.getByTestId("page-builder-canvas")).toBeVisible()
    await page.getByTestId("btn-swagger").click()
    await expect(page.getByTestId("swagger-wizard")).toBeVisible()
    // Default URL is pre-filled from NEXT_PUBLIC_API_URL.
    await page.getByTestId("swagger-fetch-btn").click()
    // Wait for the cluster list — first cluster comes from the parser.
    await expect(page.getByTestId("swagger-cluster-list")).toBeVisible({ timeout: 30_000 })
    const firstCluster = page.locator('[data-testid^="swagger-cluster-"]').first()
    await expect(firstCluster).toBeVisible()
    await firstCluster.click()
    // The wizard closes + the canvas now holds the generated schema.
    await expect(page.getByTestId("swagger-wizard")).not.toBeVisible()
    await expect(page.getByTestId("canvas-blocks-list")).toBeVisible()
    // The generated page always emits a single table block.
    await expect(page.locator('[data-block-type="table"]')).toHaveCount(1, { timeout: 5_000 })
    await page.getByTestId("btn-save").click()
    await expect(page.getByTestId("dirty-indicator")).toHaveCount(0)
  })

  // ─── Scenario 2 — Custom row button (close ticket) ────────────────────
  test("scenario 2 — add a custom row-action via the JSON editor", async ({ page }) => {
    await page.goto("/admin/page-builder")
    await page.getByTestId("palette-block-table").click()
    const tableItem = page.locator('[data-block-type="table"][data-testid^="canvas-block-item-"]').first()
    await tableItem.click()
    await expect(page.getByTestId("properties-panel")).toBeVisible()

    const editor = page.getByTestId("properties-json-editor")
    const current = await editor.inputValue()
    const parsed = JSON.parse(current) as Record<string, unknown> & { rowActions?: unknown[] }
    parsed.rowActions = [
      ...(parsed.rowActions ?? []),
      {
        id: "close-ticket",
        label: { en: "Close", ar: "إغلاق" },
        icon: "X",
        variant: "destructive",
        size: "sm",
        position: "row",
        permission: "Api.Ticket.Close",
        hidden: false,
        action: {
          type: "api",
          method: "POST",
          endpoint: "/api/app/ticket/{id}/close",
          confirm: {
            title: { en: "Close ticket?", ar: "إغلاق التذكرة؟" },
            message: { en: "This cannot be undone.", ar: "لا يمكن التراجع." },
            destructive: true,
          },
        },
        rowCondition: { field: "status", operator: "ne", value: "closed" },
      },
    ]
    await editor.fill(JSON.stringify(parsed, null, 2))
    await page.getByTestId("properties-apply").click()
    await expect(page.getByTestId("properties-json-error")).toHaveCount(0)
    await page.getByTestId("btn-save").click()
    await expect(page.getByTestId("dirty-indicator")).toHaveCount(0)
  })

  // ─── Scenario 3 — Tabbed form ─────────────────────────────────────────
  test("scenario 3 — drop a form block + switch its layout to tabs", async ({ page }) => {
    await page.goto("/admin/page-builder")
    await page.getByTestId("palette-block-form").click()
    const formItem = page.locator('[data-block-type="form"][data-testid^="canvas-block-item-"]').first()
    await formItem.click()
    const editor = page.getByTestId("properties-json-editor")
    const parsed = JSON.parse(await editor.inputValue()) as Record<string, unknown>
    parsed.layout = {
      type: "tabs",
      tabs: [
        {
          id: "basic",
          title: { en: "Basic", ar: "أساسي" },
          layout: { type: "grid", rows: [{ columns: 2, fields: ["a", "b"] }] },
        },
        {
          id: "contact",
          title: { en: "Contact", ar: "تواصل" },
          layout: { type: "grid", rows: [{ columns: 1, fields: ["c"] }] },
        },
      ],
    }
    await editor.fill(JSON.stringify(parsed, null, 2))
    await page.getByTestId("properties-apply").click()
    await expect(page.getByTestId("properties-json-error")).toHaveCount(0)
    await page.getByTestId("btn-save").click()
    await expect(page.getByTestId("dirty-indicator")).toHaveCount(0)
  })

  // ─── Scenario 4 — Mixed page (KPIs + tabs + table) ────────────────────
  test("scenario 4 — compose a mixed page with KPIs + tabs + table", async ({ page }) => {
    await page.goto("/admin/page-builder")
    await page.getByTestId("palette-block-kpi").click()
    await page.getByTestId("palette-block-tabs").click()
    await page.getByTestId("palette-block-table").click()
    const items = page.locator('[data-testid^="canvas-block-item-"]')
    await expect(items).toHaveCount(3)
    await page.getByTestId("btn-save").click()
    await expect(page.getByTestId("dirty-indicator")).toHaveCount(0)

    // Switch to preview mode + flip to mobile viewport — the layout must
    // still render every block without overflow.
    await page.getByTestId("btn-preview").click()
    await page.getByTestId("preview-viewport-mobile").click()
    await expect(page.getByTestId("preview-frame")).toHaveAttribute("data-preview-viewport", "mobile")
  })

  // ─── Scenario 5 — Materialize round-trip ──────────────────────────────
  test("scenario 5 — save then materialize round-trip", async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN !== "true",
      "Set NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN=true to run materialize",
    )
    await page.goto("/admin/page-builder")
    await page.getByTestId("palette-block-heading").click()
    await page.getByTestId("btn-save").click()
    await expect(page.getByTestId("dirty-indicator")).toHaveCount(0)

    // Confirm dialog uses window.confirm — auto-accept it.
    page.on("dialog", dialog => void dialog.accept())
    await page.getByTestId("btn-materialize").click()
    await expect(page.getByTestId("materialize-result-banner")).toBeVisible({ timeout: 60_000 })
    const banner = page.getByTestId("materialize-result-banner")
    await expect(banner).toContainText(/file\(s\) written/i)
  })
})
