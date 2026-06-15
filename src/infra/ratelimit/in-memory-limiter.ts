/**
 * In-memory fixed-window rate limiter — the dev/single-process fallback.
 *
 * Edge-runtime-compatible (no Node APIs, no external services), persists
 * for the lifetime of the worker process, bounded by `MAX_ENTRIES` with
 * lazy eviction.
 *
 * Use this when:
 *   - REDIS_URL / UPSTASH_REDIS_REST_URL are not set (dev mode, local
 *     `next dev`, single-instance demos).
 *   - You're explicitly OK with per-process counters (a single Node
 *     container with a single worker — no horizontal scaling).
 *
 * Don't use this in production behind a load balancer. With N instances,
 * an attacker who lands on different instances effectively gets
 * `N × max` per window. The factory in `index.ts` wires the Redis
 * adapter automatically when env says so.
 *
 * Algorithm: fixed-window counter. Sliding-window log is more accurate
 * but ~10× the memory and ~5× the CPU per request; the ~2× burst at
 * window boundaries is irrelevant for credential-stuffing defense — the
 * attacker is still capped to `2*max` per `windowMs`.
 *
 * Lazy eviction: edge workers don't reliably keep timers alive across
 * requests, so we don't run a background sweeper. Every insert does a
 * constant-time check; when the map exceeds the soft cap, we sweep
 * once (drop expired entries first, then the oldest 10 % if still over).
 */

import type { RateLimitResult, RateLimiter } from "./types"

interface Entry {
  count: number
  resetAt: number
}

/**
 * Soft cap on tracked (IP, route) pairs. Past this we evict expired entries
 * first, then the oldest 10 % of remaining ones. The cap exists to prevent
 * an attacker who rotates source IPs from blowing up worker memory.
 */
const MAX_ENTRIES = 10_000

export class InMemoryRateLimiter implements RateLimiter {
  private readonly store = new Map<string, Entry>()

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const entry = this.store.get(key)

    // No entry, or the previous window has fully elapsed → start a new one.
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs
      this.store.set(key, { count: 1, resetAt })
      this.maybeEvict()
      return { allowed: true, limit, remaining: limit - 1, resetAt }
    }

    // Within the active window, but already over the limit.
    if (entry.count >= limit) {
      return { allowed: false, limit, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count += 1
    return { allowed: true, limit, remaining: limit - entry.count, resetAt: entry.resetAt }
  }

  private maybeEvict(): void {
    if (this.store.size <= MAX_ENTRIES) return

    const now = Date.now()

    // First pass: drop everything that's already expired.
    for (const [k, v] of this.store) {
      if (v.resetAt <= now) this.store.delete(k)
    }
    if (this.store.size <= MAX_ENTRIES) return

    // Still over: evict the oldest 10 % by `resetAt`. Stable enough for a
    // soft cap; we don't need exact LRU semantics.
    const entries = [...this.store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toRemove = Math.ceil(this.store.size * 0.1)
    for (let i = 0; i < toRemove; i++) {
      this.store.delete(entries[i]![0])
    }
  }
}

/** Exposed for tests. Construct a fresh instance — does NOT share state. */
export function createInMemoryRateLimiter(): RateLimiter {
  return new InMemoryRateLimiter()
}
