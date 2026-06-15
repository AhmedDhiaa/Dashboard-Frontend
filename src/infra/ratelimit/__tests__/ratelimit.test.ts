/**
 * Tests for the in-memory rate limiter and the route-config table.
 *
 * The rate limiter is security-critical — it's the only thing standing
 * between the login endpoint and a credential-stuffing run. Each test below
 * locks down a behaviour we depend on: window-isolation, key-isolation,
 * post-window recovery, and the 429-trigger threshold.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { createInMemoryRateLimiter, type RateLimiter } from "../index"
import { findRateLimit, RATE_LIMITS } from "../config"

describe("InMemoryRateLimiter", () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = createInMemoryRateLimiter()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows the first request and reports remaining=limit-1", async () => {
    const result = await limiter.check("k", 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(5)
    expect(result.remaining).toBe(4)
    expect(result.resetAt).toBe(Date.now() + 60_000)
  })

  it("allows up to `limit` requests and rejects the next one", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check("k", 5, 60_000)).allowed).toBe(true)
    }
    const blocked = await limiter.check("k", 5, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it("decrements `remaining` correctly across the window", async () => {
    expect((await limiter.check("k", 3, 60_000)).remaining).toBe(2)
    expect((await limiter.check("k", 3, 60_000)).remaining).toBe(1)
    expect((await limiter.check("k", 3, 60_000)).remaining).toBe(0)
  })

  it("preserves `resetAt` across the window — it does not slide", async () => {
    const first = await limiter.check("k", 5, 60_000)
    vi.advanceTimersByTime(30_000)
    const mid = await limiter.check("k", 5, 60_000)
    expect(mid.resetAt).toBe(first.resetAt)
  })

  it("opens a new window when the current one expires", async () => {
    for (let i = 0; i < 5; i++) await limiter.check("k", 5, 60_000)
    expect((await limiter.check("k", 5, 60_000)).allowed).toBe(false)

    // Step past the window.
    vi.advanceTimersByTime(60_001)

    const fresh = await limiter.check("k", 5, 60_000)
    expect(fresh.allowed).toBe(true)
    expect(fresh.remaining).toBe(4)
  })

  it("treats different keys as fully independent", async () => {
    for (let i = 0; i < 5; i++) await limiter.check("alice", 5, 60_000)
    expect((await limiter.check("alice", 5, 60_000)).allowed).toBe(false)
    expect((await limiter.check("bob", 5, 60_000)).allowed).toBe(true)
  })

  it("blocks the 11th login attempt at the documented 10/5min cadence", async () => {
    // This is the production policy from config.ts. Lock it down explicitly
    // so a future change to the table doesn't silently weaken the policy.
    const max = 10
    const windowMs = 5 * 60_000
    for (let i = 0; i < max; i++) {
      expect((await limiter.check("login:1.2.3.4", max, windowMs)).allowed).toBe(true)
    }
    expect((await limiter.check("login:1.2.3.4", max, windowMs)).allowed).toBe(false)
  })

  it("returns retry-after-style metadata on a blocked request", async () => {
    for (let i = 0; i < 5; i++) await limiter.check("k", 5, 60_000)
    vi.advanceTimersByTime(20_000) // 20s into the window
    const blocked = await limiter.check("k", 5, 60_000)
    // Reset is 60s from the window's first request, so 40s remain.
    expect(blocked.resetAt - Date.now()).toBe(40_000)
  })
})

describe("findRateLimit (route config)", () => {
  it("matches the credentials-callback route to the auth-callback rule", () => {
    const rule = findRateLimit("/api/auth/callback/credentials")
    expect(rule).not.toBeNull()
    expect(rule?.label).toBe("auth-callback")
    expect(rule?.max).toBe(10)
    expect(rule?.windowMs).toBe(5 * 60_000)
  })

  it("matches /api/auth/signin to the auth-signin rule", () => {
    const rule = findRateLimit("/api/auth/signin")
    expect(rule?.label).toBe("auth-signin")
    expect(rule?.max).toBe(20)
  })

  it("returns null for routes not in the table", () => {
    expect(findRateLimit("/dashboard")).toBeNull()
    expect(findRateLimit("/api/health")).toBeNull()
    expect(findRateLimit("/api/auth/session")).toBeNull()
  })

  it("first-match wins (no rule overlap currently, but lock the contract)", () => {
    // If two rules ever start matching the same path, only the first runs.
    // Document the behaviour by pinning it.
    const rule = findRateLimit("/api/auth/callback/credentials")
    expect(rule).toBe(RATE_LIMITS[0])
  })
})
