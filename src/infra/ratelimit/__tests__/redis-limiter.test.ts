/**
 * Tests for the Redis-backed rate limiter.
 *
 * The adapter is the security-critical part of the load-balanced setup —
 * it's how every app instance ends up looking at the same counter. Tests
 * use a hand-rolled `RedisLike` stub (a `Map<string, number>`) so we can
 * pin behaviour without a live Redis. The fixed-window-bucket algorithm
 * means tests don't need TTL semantics — bucket keys roll over by clock,
 * not by expiry.
 *
 * What's locked down here:
 *   - First request in a window starts at 1, remaining=limit-1.
 *   - The (count+1)-th request flips `allowed` to false.
 *   - The bucket key includes the window-floor timestamp so two windows
 *     never collide.
 *   - On INCR failure, the limiter fails OPEN (allowed=true) and logs.
 *   - Two simulated app instances pointed at the SAME stub share state —
 *     the cap is global, not per-instance. This is the whole point.
 *   - The keyPrefix option scopes the namespace.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { RedisRateLimiter, type RedisLike } from "../redis-limiter"

// Tiny in-process Redis stand-in. INCR is the only stateful op; PEXPIRE
// is a recorded no-op (the real adapter doesn't read TTL — bucket keys
// rotate on the clock instead).
class StubRedis implements RedisLike {
  store = new Map<string, number>()
  incrCalls = 0
  pexpireCalls: { key: string; ttlMs: number }[] = []
  /** When set, the next `incr` rejects with this error. */
  failNextIncrWith: Error | null = null

  async incr(key: string): Promise<number> {
    this.incrCalls += 1
    if (this.failNextIncrWith) {
      const err = this.failNextIncrWith
      this.failNextIncrWith = null
      throw err
    }
    const next = (this.store.get(key) ?? 0) + 1
    this.store.set(key, next)
    return next
  }
  async pexpire(key: string, ttlMs: number): Promise<unknown> {
    this.pexpireCalls.push({ key, ttlMs })
    return 1
  }
}

describe("RedisRateLimiter", () => {
  let stub: StubRedis
  let limiter: RedisRateLimiter

  beforeEach(() => {
    stub = new StubRedis()
    limiter = new RedisRateLimiter(stub)
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("first request in a window: count=1, remaining=limit-1, resetAt at next bucket boundary", async () => {
    const result = await limiter.check("k", 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(5)
    expect(result.remaining).toBe(4)
    // Bucket = floor(now / windowMs); resetAt = (bucket+1) * windowMs.
    const now = Date.now()
    const bucket = Math.floor(now / 60_000)
    expect(result.resetAt).toBe((bucket + 1) * 60_000)
  })

  it("calls PEXPIRE on the first hit only, with the window in ms", async () => {
    await limiter.check("k", 5, 60_000)
    await limiter.check("k", 5, 60_000)
    await limiter.check("k", 5, 60_000)
    expect(stub.pexpireCalls).toHaveLength(1)
    expect(stub.pexpireCalls[0]?.ttlMs).toBe(60_000)
  })

  it("allows up to `limit` requests then flips to denied", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check("k", 5, 60_000)).allowed).toBe(true)
    }
    const blocked = await limiter.check("k", 5, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it("rolls into a fresh window when the clock crosses the bucket boundary", async () => {
    for (let i = 0; i < 5; i++) await limiter.check("k", 5, 60_000)
    expect((await limiter.check("k", 5, 60_000)).allowed).toBe(false)

    // Advance into the next bucket. The new bucket key has zero count.
    vi.advanceTimersByTime(60_001)

    const fresh = await limiter.check("k", 5, 60_000)
    expect(fresh.allowed).toBe(true)
    expect(fresh.remaining).toBe(4)
    // The limiter wrote to a DIFFERENT key for the new bucket.
    expect(stub.store.size).toBe(2)
  })

  it("two limiters pointed at the SAME store enforce a global cap (the load-balanced case)", async () => {
    // Simulates two app instances behind a load balancer, both pointing
    // at one Redis. Each `check` against the same key contributes to the
    // shared count — by the 6th request total, regardless of which
    // limiter answered, the cap fires.
    const instanceA = new RedisRateLimiter(stub)
    const instanceB = new RedisRateLimiter(stub)
    const calls = [instanceA, instanceB, instanceA, instanceB, instanceA, instanceB]
    const results = []
    for (const inst of calls) results.push(await inst.check("ip:1.2.3.4", 5, 60_000))
    // First five (across both instances) allowed; sixth blocked.
    expect(results.slice(0, 5).every(r => r.allowed)).toBe(true)
    expect(results[5]?.allowed).toBe(false)
  })

  it("namespaces by keyPrefix so two apps sharing one Redis don't collide", async () => {
    const limA = new RedisRateLimiter(stub, { keyPrefix: "appA:" })
    const limB = new RedisRateLimiter(stub, { keyPrefix: "appB:" })
    // Same logical key, different namespaces.
    await limA.check("login", 5, 60_000)
    await limA.check("login", 5, 60_000)
    await limB.check("login", 5, 60_000)
    // Stub records the actual Redis keys; we expect three distinct
    // counters, not one shared one.
    const keys = [...stub.store.keys()]
    expect(keys.some(k => k.startsWith("appA:"))).toBe(true)
    expect(keys.some(k => k.startsWith("appB:"))).toBe(true)
    expect(stub.store.get(keys.find(k => k.startsWith("appA:"))!)).toBe(2)
    expect(stub.store.get(keys.find(k => k.startsWith("appB:"))!)).toBe(1)
  })

  it("treats different keys as independent (the same as in-memory)", async () => {
    for (let i = 0; i < 5; i++) await limiter.check("alice", 5, 60_000)
    expect((await limiter.check("alice", 5, 60_000)).allowed).toBe(false)
    expect((await limiter.check("bob", 5, 60_000)).allowed).toBe(true)
  })

  it("fails OPEN when Redis throws — preferable to denying every login on a Redis blip", async () => {
    stub.failNextIncrWith = new Error("ECONNRESET")
    const result = await limiter.check("k", 5, 60_000)
    expect(result.allowed).toBe(true)
    // remaining = limit - 1 by convention so the caller can still emit
    // sensible X-RateLimit-Remaining headers.
    expect(result.remaining).toBe(4)
  })

  it("uses the default prefix when none is supplied", async () => {
    await limiter.check("login:1.2.3.4", 5, 60_000)
    const keys = [...stub.store.keys()]
    expect(keys[0]).toMatch(/^acme:rl:login:1\.2\.3\.4:/)
  })
})
