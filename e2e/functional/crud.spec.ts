import { test, expect } from "@playwright/test"

/**
 * The config-driven CRUD list surface for the `user` entity is reachable and
 * authenticated against the in-memory mock backend — the list shell renders with
 * its search toolbar, without bouncing to login or hitting the not-found page.
 * (Creation is a modal on the list, not a standalone route.)
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
    // The global command/search affordance is present on the authenticated shell.
    await expect(page.getByRole("searchbox").first()).toBeVisible({ timeout: 45_000 })
  })
})
