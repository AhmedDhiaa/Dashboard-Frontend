/**
 * Per-IP, per-route rate limiting.
 *
 * The middleware imports the `rateLimiter` singleton from this module;
 * this file decides which backend it points at:
 *
 *   1. Upstash REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
 *      — first preference. Pure HTTP, edge-runtime-compatible. The right
 *      pick when the middleware runs on the edge (Vercel default).
 *
 *   2. ioredis (`REDIS_URL`) — second preference. TCP-based, Node-only.
 *      Use when the middleware is configured for the Node.js runtime
 *      (`export const runtime = "nodejs"` or for self-hosted Redis behind
 *      a private network without a REST proxy).
 *
 *   3. In-memory — fallback. Per-process counter; per-process counters
 *      become useless behind a load balancer (each instance counts only
 *      its own traffic). Documented in `in-memory-limiter.ts`.
 *
 * The middleware integration in `middleware.ts` doesn't need to know
 * which adapter is live — it `await rateLimiter.check(...)` against
 * the same interface in either case.
 *
 * Adapter packages aren't bundled by default. To activate Redis in
 * production: `npm install @upstash/redis` (Upstash) or `npm install
 * ioredis` (self-hosted), then set the matching env vars. Both adapters
 * dynamic-import their client at first call so `npm install` is the
 * only required step — no code change.
 *
 * @module infra/ratelimit
 */

import type { RateLimiter, RateLimitResult } from "./types"
import { InMemoryRateLimiter, createInMemoryRateLimiter } from "./in-memory-limiter"
import { RedisRateLimiter, type RedisLike } from "./redis-limiter"
import { logger } from "@/shared/logger"

export type { RateLimiter, RateLimitResult } from "./types"
export { InMemoryRateLimiter, createInMemoryRateLimiter } from "./in-memory-limiter"
export { RedisRateLimiter } from "./redis-limiter"

/**
 * Build the Upstash REST client lazily. Returns `null` if env isn't
 * set or the package isn't installed; the caller falls back to the next
 * tier in priority order.
 */
async function tryUpstashClient(): Promise<RedisLike | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    // Dynamic import via a string variable + bundler-ignore magic
    // comments: keeps Webpack/Turbopack/vite from trying to resolve the
    // optional peer when it isn't installed (Next emits a "Module not
    // found" warning during the Edge middleware bundle otherwise, since
    // middleware.ts pulls this module into its graph).
    // Edge-runtime-safe — `@upstash/redis` is HTTP-only.
    const moduleName: string = "@upstash/redis"
    const { Redis } = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleName)) as {
      Redis: new (cfg: { url: string; token: string }) => RedisLike
    }
    return new Redis({ url, token })
  } catch (err) {
    logger.warn(
      "[ratelimit] UPSTASH_REDIS_REST_URL is set but @upstash/redis is not installed. " +
        "Run `npm install @upstash/redis` to activate the Upstash adapter. " +
        "Falling back to the next available backend.",
      err,
    )
    return null
  }
}

/**
 * Build an ioredis client lazily. Returns `null` if env isn't set, the
 * package isn't installed, or we're running in edge runtime (where
 * ioredis can't open TCP sockets).
 */
async function tryIoredisClient(): Promise<RedisLike | null> {
  const url = process.env.REDIS_URL
  if (!url) return null

  // Edge runtime cannot open TCP sockets. Refuse to load ioredis there;
  // misconfigured deployments that need Redis on the edge should set
  // UPSTASH_REDIS_REST_URL instead.
  if (typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined") {
    logger.warn(
      "[ratelimit] REDIS_URL is set but middleware is running on the edge runtime " +
        "(ioredis needs Node.js TCP). Set UPSTASH_REDIS_REST_URL instead, or move the " +
        "middleware to the Node.js runtime. Falling back to in-memory.",
    )
    return null
  }

  try {
    // String-variable trick + bundler-ignore comments — see tryUpstashClient.
    const moduleName: string = "ioredis"
    const mod = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ moduleName)) as {
      default: new (url: string) => unknown
    }
    const RedisCtor = mod.default
    return new RedisCtor(url) as RedisLike
  } catch (err) {
    logger.warn(
      "[ratelimit] REDIS_URL is set but ioredis is not installed. " +
        "Run `npm install ioredis` to activate the self-hosted adapter. " +
        "Falling back to in-memory.",
      err,
    )
    return null
  }
}

/**
 * Pick the best available adapter. Probed once per process; subsequent
 * `check()` calls go straight to the chosen backend.
 */
async function selectBackend(): Promise<RateLimiter> {
  const upstash = await tryUpstashClient()
  if (upstash) {
    logger.info("[ratelimit] backend: Upstash REST")
    return new RedisRateLimiter(upstash)
  }
  const ioredisClient = await tryIoredisClient()
  if (ioredisClient) {
    logger.info("[ratelimit] backend: ioredis")
    return new RedisRateLimiter(ioredisClient)
  }
  logger.info("[ratelimit] backend: in-memory (per-process)")
  return new InMemoryRateLimiter()
}

/**
 * Wraps `selectBackend()` so the first request triggers the env probe
 * and every subsequent request reuses the same instance. Until the
 * probe resolves, requests fall back to in-memory — a small grace
 * window is preferable to deferring all middleware work behind a
 * single async boot promise.
 */
class LazyRateLimiter implements RateLimiter {
  private readonly fallback: RateLimiter = new InMemoryRateLimiter()
  private backend: RateLimiter | null = null
  private bootPromise: Promise<RateLimiter> | null = null

  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    if (this.backend) return this.backend.check(key, limit, windowMs)
    if (!this.bootPromise) {
      this.bootPromise = selectBackend().then(b => {
        this.backend = b
        return b
      })
      // First request gets the in-memory fallback; once boot resolves,
      // subsequent requests go to the real backend.
    }
    return this.fallback.check(key, limit, windowMs)
  }
}

/**
 * The module-level singleton. Shared across all middleware invocations
 * in the same worker process — backed by Redis if env says so, in-memory
 * otherwise.
 */
export const rateLimiter: RateLimiter = new LazyRateLimiter()

/**
 * Test seam: build a fresh limiter wired against an arbitrary RedisLike
 * client, bypassing the env probe entirely. Used by the Redis-adapter
 * tests that supply a stub client. Also re-exported for callers that
 * want to drive their own client lifecycle (e.g., a Node-only API
 * route building its own ioredis instance and passing it in).
 *
 * @public
 */
export function createRedisRateLimiter(client: RedisLike): RateLimiter {
  return new RedisRateLimiter(client)
}

// Re-export the in-memory factory under the same name path for backward
// compat with tests that imported it from `index.ts`.
void createInMemoryRateLimiter
