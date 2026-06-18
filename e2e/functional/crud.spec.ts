import { test, expect } from "@playwright/test"

/**
 * The config-driven CRUD list surface for the `user` entity, against the
 * in-memory mock backend — reachable, authenticated, and rendering its list
 * shell (the global search affordance). The data table body itself loads via the
 * entity registry's lazy chunks, which don't settle deterministically inside the
 * headless E2E browser (dev OR prod standalone), so per-row data is asserted in
 * the unit/integration suites rather than here. (Creation is a modal on the
 * list, not a standalone route.)
 */
const LIST = "/users"
const NOT_FOUND_TEXT = "الصفحة غير موجودة"

test.describe("crud (authenticated, mock data)", () => {
  test("entity list route renders the authenticated list shell", async ({ page }) => {
    await page.goto(LIST, { waitUntil: "domcontentloaded" })
    await expect(page).not.toHaveURL(/\/auth\/login/)
    const main = page.locator("#main-content")
    await expect(main).toBeVisible({ timeout: 45_000 })
    await expect(main).not.toContainText(NOT_FOUND_TEXT)
    await expect(page.getByRole("searchbox").first()).toBeVisible({ timeout: 45_000 })
  })
})
