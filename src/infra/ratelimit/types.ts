/**
 * Shared types for the rate-limit subsystem. Adapters (in-memory, Redis,
 * future ones) all implement `RateLimiter`; middleware depends only on
 * this interface so swapping backends is one factory edit.
 */

export interface RateLimitResult {
  /** True when the request is within the limit and should proceed. */
  allowed: boolean
  /** Maximum requests permitted in the current window. */
  limit: number
  /** Requests remaining in the current window after this one. */
  remaining: number
  /** Unix-ms timestamp at which the current window resets. */
  resetAt: number
}

export interface RateLimiter {
  /**
   * Record a request against the given key and return whether it's allowed.
   *
   * Async because real backends (Redis) round-trip the network. The
   * in-memory adapter resolves synchronously via `Promise.resolve` — the
   * call site pays one microtask, no network.
   *
   * @param key      Per-route per-actor identifier (e.g. `${ip}:${pathname}`).
   * @param limit    Max requests allowed in `windowMs`.
   * @param windowMs Window duration in milliseconds.
   */
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>
}
