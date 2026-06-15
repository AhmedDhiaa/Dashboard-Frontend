/**
 * RTL screenshot regression suite.
 *
 * Captures the four canonical surfaces named in Task 30 — dashboard,
 * sidebar (in isolation, by viewing any page), list page, edit page —
 * with the Arabic locale forced via the `NEXT_LOCALE` cookie.
 *
 * Snapshots are stored under `e2e/__screenshots__/`. To regenerate after
 * an intentional UI change, run `npm run test:e2e:rtl:update`.
 *
 * The first three pages require a logged-in session. We piggyback on
 * NextAuth's `authjs.session-token` cookie supplied via the
 * APP_E2E_AUTH_COOKIE env var. When unset, those tests skip cleanly
 * so a developer running this locally without prepping a session still
 * gets useful feedback (the public auth/login surface is always tested).
 */

import { test, expect, type Page } from "@playwright/test"

const SESSION_COOKIE = process.env.APP_E2E_AUTH_COOKIE
const BASE_URL = process.env.APP_E2E_BASE_URL ?? "http://localhost:3000"
// NextAuth's default v5 cookie name; override with APP_E2E_AUTH_COOKIE_NAME
// if the deployment runs with a custom name.
const SESSION_COOKIE_NAME = process.env.APP_E2E_AUTH_COOKIE_NAME ?? "authjs.session-token"

async function setArabicLocale(page: Page): Promise<void> {
  const url = new URL(BASE_URL)
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: "ar",
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ])
}

async function setSessionCookie(page: Page): Promise<void> {
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

// Wait for layout to stabilise: idle network + animations finished. Helps
// avoid mid-transition screenshots when navigating between routes.
async function waitForStable(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle")
  // Defer one frame so layout-effect-driven re-paints settle.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(undefined))))
}

test.describe("RTL screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await setArabicLocale(page)
    await setSessionCookie(page)
  })

  test("auth/login renders RTL", async ({ page }) => {
    await page.goto("/auth/login")
    await waitForStable(page)
    expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expect(page).toHaveScreenshot("auth-login.png", { fullPage: true })
  })

  test("dashboard renders RTL", async ({ page }) => {
    test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to capture authed routes")
    await page.goto("/dashboard")
    await waitForStable(page)
    expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expect(page).toHaveScreenshot("dashboard.png", { fullPage: true })
  })

  test("sidebar renders RTL (anchored at start, content offset to start)", async ({ page }) => {
    test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to capture authed routes")
    await page.goto("/dashboard")
    await waitForStable(page)
    // Sidebar is the first <aside>; under RTL it sits on the right edge.
    const sidebar = page.locator("aside").first()
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toHaveScreenshot("sidebar.png")
  })

  test("list page renders RTL (cities)", async ({ page }) => {
    test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to capture authed routes")
    await page.goto("/cities")
    await waitForStable(page)
    expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expect(page).toHaveScreenshot("list-cities.png", { fullPage: true })
  })

  test("edit page renders RTL (orders/create — same layout as edit)", async ({ page }) => {
    test.skip(!SESSION_COOKIE, "Set APP_E2E_AUTH_COOKIE to capture authed routes")
    // /orders/create reuses the same form layout as /orders/[id]/edit and
    // doesn't need a real record id; ideal for screenshot stability.
    await page.goto("/orders/create")
    await waitForStable(page)
    expect(page.locator("html")).toHaveAttribute("dir", "rtl")
    await expect(page).toHaveScreenshot("edit-order.png", { fullPage: true })
  })
})
