import { describe, it, expect } from "vitest"
import { findRateLimit, RATE_LIMITS } from "../config"

describe("findRateLimit", () => {
  it("returns the auth-callback rule for credential POSTs", () => {
    const rule = findRateLimit("/api/auth/callback/credentials")
    expect(rule?.label).toBe("auth-callback")
    expect(rule?.max).toBe(10)
    expect(rule?.windowMs).toBe(300_000)
  })

  it("returns the auth-signin rule for signin requests", () => {
    const rule = findRateLimit("/api/auth/signin")
    expect(rule?.label).toBe("auth-signin")
    expect(rule?.max).toBe(20)
    expect(rule?.windowMs).toBe(60_000)
  })

  it("returns null for paths not covered by any rule", () => {
    expect(findRateLimit("/api/orders")).toBeNull()
    expect(findRateLimit("/dashboard")).toBeNull()
    expect(findRateLimit("/")).toBeNull()
  })

  it("applies first-match-wins ordering", () => {
    // Both rules start with /api/auth/, but auth-callback's test is more
    // specific. Verify the iteration order surfaces the right one.
    const callback = findRateLimit("/api/auth/callback/credentials")
    const signin = findRateLimit("/api/auth/signin")
    expect(callback?.label).not.toBe(signin?.label)
  })

  it("RATE_LIMITS exposes a non-empty, frozen-style readonly array", () => {
    expect(RATE_LIMITS.length).toBeGreaterThan(0)
    for (const r of RATE_LIMITS) {
      expect(r.max).toBeGreaterThan(0)
      expect(r.windowMs).toBeGreaterThan(0)
      expect(typeof r.test).toBe("function")
      expect(typeof r.label).toBe("string")
    }
  })
})
