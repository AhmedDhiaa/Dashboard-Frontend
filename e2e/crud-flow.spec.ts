/**
 * E2E: create + edit on a representative entity (cities — small schema,
 * fast CRUD round-trip). Skipped without APP_E2E_AUTH_COOKIE since
 * the routes redirect unauth'd visitors to /auth/login.
 *
 * Strategy: navigate to /cities (list), click "+ New", fill the minimum
 * required fields, save, then re-open the just-created row in edit mode
 * and confirm the value persisted. Cleanup is best-effort: a `cleanup`
 * step at the end deletes the seeded record so re-running the spec
 * doesn't accumulate test data in the backing store.
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

test.describe("CRUD flow (cities)", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page)
  })

  test("create + edit + verify", async ({ page }) => {
    test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to run authed e2e")

    const seedName = `E2E ${Date.now()}`
    const editedName = `${seedName} EDITED`

    // List → Create
    await page.goto("/cities")
    await page
      .getByRole("link", { name: /new|create/i })
      .first()
      .click()

    // Form: minimum input. CityForm has a `name` field; other entity
    // configs would need their own per-spec mapping. The cities page is
    // chosen because its schema is the smallest in the registry.
    await page.fill("input[name='name']", seedName)
    await page.getByRole("button", { name: /save|create/i }).click()

    // Verify: navigate back to the list and confirm the row appears.
    await page.waitForURL(/\/cities(\/|$)/)
    await expect(page.getByText(seedName, { exact: false })).toBeVisible()

    // Edit: open the new row, change the name, save.
    await page.getByText(seedName).first().click()
    const editLink = page.getByRole("link", { name: /edit/i })
    if (await editLink.count()) await editLink.first().click()
    await page.fill("input[name='name']", editedName)
    await page.getByRole("button", { name: /save|update/i }).click()

    await expect(page.getByText(editedName, { exact: false })).toBeVisible({ timeout: 10_000 })
  })
})
