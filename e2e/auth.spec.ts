/**
 * E2E: login flow.
 *
 * Validates that the public /auth/login surface renders, accepts input,
 * and (when APP_E2E_USERNAME / APP_E2E_PASSWORD are set) reaches a
 * post-login redirect target. With no credentials configured we still
 * assert the form's accessibility shape — useful as a smoke test.
 */

import { test, expect } from "@playwright/test"

const USERNAME = process.env.APP_E2E_USERNAME
const PASSWORD = process.env.APP_E2E_PASSWORD

test.describe("auth/login", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/auth/login")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.locator("input[name='username'], input[type='email']").first()).toBeVisible()
    await expect(page.locator("input[type='password']")).toBeVisible()
  })

  test("submits credentials and redirects to dashboard", async ({ page }) => {
    test.skip(!USERNAME || !PASSWORD, "Set APP_E2E_USERNAME + APP_E2E_PASSWORD to run")
    await page.goto("/auth/login")
    await page.fill("input[name='username'], input[type='email']", USERNAME!)
    await page.fill("input[type='password']", PASSWORD!)
    await page.locator("button[type='submit']").click()
    // Allow up to 15s for OAuth2 round-trip + middleware redirect.
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15_000 })
    expect(page.url()).toMatch(/\/(dashboard|$)/)
  })
})
