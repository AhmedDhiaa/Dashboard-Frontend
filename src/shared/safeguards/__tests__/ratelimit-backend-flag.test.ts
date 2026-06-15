/**
 * Pin the rate-limit backend safeguard truth table.
 *
 *   NODE_ENV     | UPSTASH_URL+TOKEN | REDIS_URL | OVERRIDE     | result
 *   -------------|-------------------|-----------|--------------|------------------------------
 *   development  | -                 | -         | -            | ok (not-production)
 *   production   | both set          | -         | -            | ok (upstash-configured)
 *   production   | -                 | set       | -            | ok (redis-configured)
 *   production   | both set          | set       | -            | ok (upstash wins; first match)
 *   production   | -                 | -         | exact token  | ok (override-acknowledged)
 *   production   | -                 | -         | wrong token  | FAIL
 *   production   | -                 | -         | -            | FAIL
 *   production   | url only          | -         | -            | FAIL (token missing → no upstash)
 */

import { describe, expect, it } from "vitest"
import { RATELIMIT_OVERRIDE, RATELIMIT_OVERRIDE_TOKEN, checkRateLimitBackend } from "../ratelimit-backend-flag"

describe("checkRateLimitBackend — non-production paths always pass", () => {
  it("development with no Redis → ok (not-production)", () => {
    const r = checkRateLimitBackend({ NODE_ENV: "development" })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("not-production")
  })

  it("undefined NODE_ENV → ok (not-production)", () => {
    const r = checkRateLimitBackend({})
    expect(r.ok).toBe(true)
  })
})

describe("checkRateLimitBackend — production with shared store passes", () => {
  it("Upstash url + token → upstash-configured", () => {
    const r = checkRateLimitBackend({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("upstash-configured")
  })

  it("REDIS_URL alone → redis-configured", () => {
    const r = checkRateLimitBackend({
      NODE_ENV: "production",
      REDIS_URL: "redis://localhost:6379",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("redis-configured")
  })

  it("both Upstash and REDIS_URL → upstash wins (matched first)", () => {
    const r = checkRateLimitBackend({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
      REDIS_URL: "redis://localhost:6379",
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("upstash-configured")
  })
})

describe("checkRateLimitBackend — production override path", () => {
  it("exact override token unblocks the gate", () => {
    const r = checkRateLimitBackend({
      NODE_ENV: "production",
      [RATELIMIT_OVERRIDE]: RATELIMIT_OVERRIDE_TOKEN,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.reason).toBe("override-acknowledged")
  })

  it("override with wrong value still fails", () => {
    const r = checkRateLimitBackend({
      NODE_ENV: "production",
      [RATELIMIT_OVERRIDE]: "true",
    })
    expect(r.ok).toBe(false)
  })
})

describe("checkRateLimitBackend — production without shared store fails", () => {
  it("no Redis, no override → fails with the diagnostic message", () => {
    const r = checkRateLimitBackend({ NODE_ENV: "production" })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe("production-without-shared-store")
      expect(r.message).toContain("REDIS_URL")
      expect(r.message).toContain("UPSTASH_REDIS_REST_URL")
      expect(r.message).toContain(RATELIMIT_OVERRIDE)
    }
  })

  it("Upstash URL set without token → fails (token is required)", () => {
    const r = checkRateLimitBackend({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    })
    expect(r.ok).toBe(false)
  })
})
