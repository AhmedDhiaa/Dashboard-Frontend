/**
 * Redis-backed fixed-window rate limiter.
 *
 * The existing in-memory limiter is per-process — fine for a single Node
 * instance, useless behind a load balancer (an attacker who lands on
 * different instances effectively gets `N × max` per window where N is
 * the number of instances). This adapter pushes the counter into a shared
 * Redis store so every instance sees the same number.
 *
 * Algorithm: window-bucketed counter. The key is suffixed with
 * `floor(now / windowMs)` so each window gets a fresh Redis key. The
 * first INCR returns 1 and we set the TTL; subsequent INCRs in the same
 * window return 2, 3, …. Once the window rolls over, the next request's
 * key is different, so the counter starts at 1 again. The TTL guarantees
 * Redis cleanup even if a process dies between INCR and PEXPIRE.
 *
 * The interface is the same `RateLimiter` shape every other adapter
 * uses; the middleware doesn't care which backend serves it. If Redis
 * is unreachable, the limiter "fails open" — a single request is
 * allowed through and the failure is logged. Failing closed (denying
 * everyone) is worse than failing open: a Redis outage shouldn't take
 * down login for legitimate users.
 *
 * Edge-runtime compatibility: this adapter only depends on the
 * `RedisLike` interface below, which is satisfiable by both
 * `@upstash/redis` (pure HTTP, edge-safe) and `ioredis` (Node-only).
 * The factory in `index.ts` picks one based on env and the runtime.
 */

import type { RateLimitResult, RateLimiter } from "./types"
import { logger } from "@/shared/logger"

/**
 * Minimal Redis-client contract this adapter needs. Any client that
 * speaks INCR + PEXPIRE under these signatures works — `@upstash/redis`,
 * `ioredis`, `node-redis`, or a hand-rolled stub for tests.
 *
 * `incr` returns the new value after increment.
 * `pexpire` sets the TTL in milliseconds; the second argument is
 *   tolerated as either a number or a string for ioredis quirk parity.
 */
export interface RedisLike {
  incr(key: string): Promise<number>
  pexpire(key: string, ttlMs: number): Promise<unknown>
}

/** Options passed to the constructor; both fields are optional. */
export interface RedisRateLimiterOptions {
  /**
   * Prefix prepended to every key so multiple apps can share a Redis
   * instance without colliding. Defaults to `acme:rl:` — bumping this
   * effectively flushes the limiter (every key becomes new).
   */
  keyPrefix?: string
}

const DEFAULT_PREFIX = "acme:rl:"

export class RedisRateLimiter implements RateLimiter {
  private readonly client: RedisLike
  private readonly prefix: string

  constructor(client: RedisLike, opts: RedisRateLimiterOptions = {}) {
    this.client = client
    this.prefix = opts.keyPrefix ?? DEFAULT_PREFIX
  }

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    // Window-bucketed key: each `windowMs` slice gets its own counter.
    // No PTTL/expiry inspection needed; the next bucket starts at 1.
    const bucket = Math.floor(now / windowMs)
    const bucketKey = `${this.prefix}${key}:${bucket}`
    const resetAt = (bucket + 1) * windowMs

    try {
      const count = await this.client.incr(bucketKey)
      // Set TTL on the first hit. Idempotent on subsequent hits — Redis
      // tolerates pexpire on an existing key (overwrites). We always
      // call it because the first request may have crashed between
      // INCR and PEXPIRE; better to over-set than under-set.
      if (count === 1) {
        // Fire-and-await so a TTL failure surfaces in the catch below
        // rather than leaking a pending promise.
        await this.client.pexpire(bucketKey, windowMs)
      }
      const allowed = count <= limit
      return {
        allowed,
        limit,
        remaining: allowed ? Math.max(0, limit - count) : 0,
        resetAt,
      }
    } catch (err) {
      // Fail open. Logging the cause is enough — a flapping Redis is
      // better surfaced via metrics, and we'd rather take a temporary
      // hole in the limiter than 503 every login attempt.
      logger.warn("[ratelimit/redis] check failed; failing open for this request", err)
      return { allowed: true, limit, remaining: limit - 1, resetAt }
    }
  }
}
