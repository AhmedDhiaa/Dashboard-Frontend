/**
 * Regression net for `getClientIP` — the rate-limit bucketing key.
 *
 * The previous default trusted the LEFTMOST `X-Forwarded-For` entry, which a
 * client fully controls by prepending forged hops — letting an attacker rotate
 * the header per request to split the login/brute-force counter across forged
 * IPs (OWASP A07). These tests pin the secure-by-default behaviour:
 *
 *   - default (unset)         → RIGHTMOST entry minus TRUSTED_PROXY_HOPS
 *   - TRUSTED_PROXY_HEADERS=1  → leftmost (explicit opt-in to a rewriting proxy)
 *   - TRUSTED_PROXY_HEADERS=0  → single global bucket (no trustworthy proxy)
 */

import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl/middleware", () => ({
  default: () => () => null,
}))

import { NextRequest } from "next/server"
import { getClientIP } from "../middleware"

function req(headers: Record<string, string>): NextRequest {
  return new NextRequest("https://app.example.com/api/auth/signin", { headers })
}

describe("getClientIP", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("default: takes the RIGHTMOST XFF entry (the one our proxy appended), not the spoofable leftmost", () => {
    // Attacker prepends `1.2.3.4`; the real proxy appends the observed client.
    const ip = getClientIP(req({ "x-forwarded-for": "1.2.3.4, 9.9.9.9, 203.0.113.7" }))
    expect(ip).toBe("203.0.113.7")
  })

  it("default: a single forged leftmost value can't shift the bucket across requests", () => {
    const a = getClientIP(req({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }))
    const b = getClientIP(req({ "x-forwarded-for": "10.0.0.99, 203.0.113.7" }))
    expect(a).toBe("203.0.113.7")
    expect(b).toBe("203.0.113.7") // same real client → same bucket
  })

  it("default: TRUSTED_PROXY_HOPS steps back over known internal proxies", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1")
    const ip = getClientIP(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.5" }))
    // One hop back from the rightmost (the internal 10.0.0.5) → the real client.
    expect(ip).toBe("203.0.113.7")
  })

  it("default: clamps hops to index 0 rather than going negative", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "5")
    const ip = getClientIP(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.5" }))
    expect(ip).toBe("203.0.113.7")
  })

  it("TRUSTED_PROXY_HEADERS=1: explicit opt-in trusts the leftmost original client", () => {
    vi.stubEnv("TRUSTED_PROXY_HEADERS", "1")
    const ip = getClientIP(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.5" }))
    expect(ip).toBe("203.0.113.7")
  })

  it("TRUSTED_PROXY_HEADERS=0: collapses everyone into one global bucket", () => {
    vi.stubEnv("TRUSTED_PROXY_HEADERS", "0")
    const ip = getClientIP(req({ "x-forwarded-for": "203.0.113.7" }))
    expect(ip).toBe("unverified-client")
  })

  it("falls back to x-real-ip when no XFF is present", () => {
    const ip = getClientIP(req({ "x-real-ip": "198.51.100.4" }))
    expect(ip).toBe("198.51.100.4")
  })

  it("returns 'unknown' when no proxy headers are present", () => {
    const ip = getClientIP(req({}))
    expect(ip).toBe("unknown")
  })
})
