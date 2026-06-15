/**
 * CSP / nonce regression net for the middleware (Task B6).
 *
 * Two layers:
 *
 *   1. `buildScriptSrc(nonce)` — the pure function that decides what
 *      `script-src` looks like in dev vs prod. Cheap to exercise; pins
 *      the production policy that earns the Mozilla Observatory A grade.
 *
 *   2. The middleware itself — invoked through a fake `NextRequest`. We
 *      assert that:
 *        - production responses include a `Content-Security-Policy`
 *          header with `nonce-...` and NO `'unsafe-inline'`
 *        - the same nonce is forwarded as `x-nonce` on the request that
 *          flows through to the layout
 *        - dev responses keep `'unsafe-inline'` and DO NOT carry a nonce
 *
 * The middleware imports `next-intl/middleware` and our intl plugin pulls
 * messages off disk; we mock it to return `null` so the test focus stays
 * on the CSP shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl/middleware", () => ({
  default: () => () => null,
}))

import { NextRequest } from "next/server"
// `vi.mock` calls are hoisted by vitest so the import below sees the
// stubbed `next-intl/middleware` even though it's a static import.
import { buildScriptSrc, default as middleware } from "../middleware"

// ─── Layer 1: buildScriptSrc pure function ──────────────────────────────────

describe("buildScriptSrc", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("development: keeps 'unsafe-inline' AND 'unsafe-eval' for HMR", () => {
    vi.stubEnv("NODE_ENV", "development")
    const out = buildScriptSrc("ignored-in-dev")
    expect(out).toContain("'unsafe-inline'")
    expect(out).toContain("'unsafe-eval'")
    // No nonce in dev — the 'unsafe-inline' covers our scripts AND
    // Next's HMR-injected unnonced ones.
    expect(out).not.toContain("'nonce-")
  })

  it("production: drops 'unsafe-inline', emits the nonce", () => {
    vi.stubEnv("NODE_ENV", "production")
    const out = buildScriptSrc("0123456789abcdef")
    expect(out).toContain("'nonce-0123456789abcdef'")
    expect(out).not.toContain("'unsafe-inline'")
    expect(out).not.toContain("'unsafe-eval'")
  })

  it("production: still allows 'self' and Google Maps", () => {
    vi.stubEnv("NODE_ENV", "production")
    const out = buildScriptSrc("nonce-value")
    expect(out).toMatch(/^script-src\s/)
    expect(out).toContain("'self'")
    expect(out).toContain("https://maps.googleapis.com")
  })
})

// ─── Layer 2: middleware end-to-end ─────────────────────────────────────────

function makeRequest(pathname: string, headers: Record<string, string> = {}): NextRequest {
  const url = new URL(`https://example.com${pathname}`)
  // NextRequest's constructor accepts a URL + RequestInit. The headers
  // initialise both `request.headers` and propagate to the cookie store
  // when set as `cookie:` — we don't need cookies for CSP tests.
  return new NextRequest(url, { headers })
}

describe("middleware — CSP header in production", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("attaches a Content-Security-Policy with a fresh nonce on a public route", async () => {
    // /auth/login is in PUBLIC_PATHS so the middleware doesn't redirect
    // unauthenticated requests away — we get the full pipeline including
    // addSecurityHeaders.
    const res = await middleware(makeRequest("/auth/login"))
    const csp = res.headers.get("Content-Security-Policy")
    expect(csp).toBeTruthy()
    expect(csp).toMatch(/script-src [^;]*'nonce-[a-f0-9-]{36}'/)
    expect(csp).not.toMatch(/script-src [^;]*'unsafe-inline'/)
  })

  it("forwards the same nonce on the `x-nonce` request header", async () => {
    const res = await middleware(makeRequest("/auth/login"))
    const csp = res.headers.get("Content-Security-Policy") ?? ""
    const nonceMatch = csp.match(/'nonce-([a-f0-9-]{36})'/)
    expect(nonceMatch, "CSP must contain a nonce").toBeTruthy()
    const nonce = nonceMatch![1]!

    // NextResponse.next({ request: { headers: ... } }) surfaces the
    // augmented request headers as `x-middleware-request-x-nonce`. That
    // is the contract Next uses to forward request-header rewrites.
    const forwarded = res.headers.get("x-middleware-request-x-nonce") ?? res.headers.get("x-nonce")
    expect(forwarded).toBe(nonce)
  })

  it("issues a fresh nonce per request (not a singleton)", async () => {
    const a = await middleware(makeRequest("/auth/login"))
    const b = await middleware(makeRequest("/auth/login"))
    const nonceA = a.headers.get("Content-Security-Policy")?.match(/'nonce-([^']+)'/)?.[1]
    const nonceB = b.headers.get("Content-Security-Policy")?.match(/'nonce-([^']+)'/)?.[1]
    expect(nonceA).toBeTruthy()
    expect(nonceB).toBeTruthy()
    expect(nonceA).not.toBe(nonceB)
  })
})

describe("middleware — CSP header in development", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("keeps 'unsafe-inline' so Next HMR keeps working", async () => {
    const res = await middleware(makeRequest("/auth/login"))
    const csp = res.headers.get("Content-Security-Policy") ?? ""
    expect(csp).toMatch(/script-src [^;]*'unsafe-inline'/)
    expect(csp).not.toMatch(/'nonce-/)
  })

  it("does NOT forward an x-nonce header (dev path skips minting)", async () => {
    const res = await middleware(makeRequest("/auth/login"))
    const forwarded = res.headers.get("x-middleware-request-x-nonce") ?? res.headers.get("x-nonce")
    expect(forwarded ?? "").toBe("")
  })
})
