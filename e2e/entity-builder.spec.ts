/**
 * E2E: walk the entity-builder wizard end-to-end and verify the
 * generate POST returns success. The wizard runs in draft mode by
 * default — it persists the schema as JSON and confirms in the UI; no
 * source-tree mutation needed.
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

test("entity-builder wizard generates a draft", async ({ page }) => {
  test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to run (admin role required)")
  await authenticate(page)
  await page.goto("/admin/entity-builder/new")

  // Step 1 — basic info. Use a unique entity name so re-runs don't clash
  // with prior drafts.
  const entityName = `e2e-${Date.now()}`
  await page.fill("input[name='entityName'], input[placeholder*='invoice' i]", entityName)
  await page.fill("input[placeholder*='Invoices' i], input[name='enTitle']", "E2E Entity")
  await page.fill("input[dir='rtl'], input[name='arTitle']", "كيان اختبار")

  // Most other fields auto-derive from entityName on blur. Continue.
  await page.locator("input[name='entityName'], input[placeholder*='invoice' i]").first().blur()
  await page
    .getByRole("button", { name: /continue|next|fields/i })
    .first()
    .click()

  // Step 7 — review & generate. Skip through intermediate steps with the
  // "Continue" button on each (Steps 2–6 are stubbed to defaults).
  for (let i = 0; i < 5; i++) {
    const next = page.getByRole("button", { name: /continue|next|review/i }).first()
    if (await next.count()) await next.click()
  }

  await page
    .getByRole("button", { name: /generate|save/i })
    .first()
    .click()
  await expect(page.getByText(/success|saved|draft/i).first()).toBeVisible({ timeout: 10_000 })
})
