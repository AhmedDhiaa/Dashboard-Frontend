import { test, expect } from "@playwright/test"

test.describe("smoke (authenticated)", () => {
  test("dashboard renders real content for the authenticated user", async ({ page }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" })
    expect(res?.status()).toBeLessThan(400)
    await expect(page).not.toHaveURL(/\/auth\/login/)

    // The authenticated shell + a real, non-empty heading inside the main region
    // (login has no #main-content, so this also proves the session was accepted).
    const main = page.locator("#main-content")
    await expect(main).toBeVisible({ timeout: 45_000 })
    await expect(main.locator("h1, h2").filter({ hasText: /\S/ }).first()).toBeVisible({ timeout: 45_000 })
  })
})
