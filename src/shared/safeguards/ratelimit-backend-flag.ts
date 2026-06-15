/**
 * Production startup safeguard for the rate-limit backend.
 *
 * The in-memory limiter (`InMemoryRateLimiter`) keeps its counters in a
 * per-process Map. Behind a load balancer with N Node instances and no
 * shared store, an attacker effectively gets N×limit before any one
 * process starts blocking — every IP-based cap silently scales with the
 * deployment topology, defeating the purpose of having a cap at all.
 *
 * In production we therefore require a shared store: either Upstash
 * (`UPSTASH_REDIS_REST_URL` + token) or self-hosted Redis (`REDIS_URL`).
 * If neither is set we refuse to boot, mirroring the runtime-codegen
 * safeguard's two-key pattern: an explicit
 * `APP_ALLOW_INMEMORY_RATELIMIT_PROD_OVERRIDE=i-understand-the-risks`
 * unblocks the gate for legitimate single-instance prod deployments
 * (e.g. an internal staging box where Redis isn't worth it).
 *
 * Pure function — env values are passed in so unit tests can drive every
 * combination without mutating `process.env`. The instrumentation hook
 * turns `result.ok === false` into a fatal log + `process.exit(1)`.
 */

export const RATELIMIT_OVERRIDE = "APP_ALLOW_INMEMORY_RATELIMIT_PROD_OVERRIDE"
export const RATELIMIT_OVERRIDE_TOKEN = "i-understand-the-risks"

export interface RateLimitEnv {
  NODE_ENV?: string | undefined
  REDIS_URL?: string | undefined
  UPSTASH_REDIS_REST_URL?: string | undefined
  UPSTASH_REDIS_REST_TOKEN?: string | undefined
  [RATELIMIT_OVERRIDE]?: string | undefined
}

export type RateLimitSafeguardResult =
  | { ok: true; reason: "not-production" | "redis-configured" | "upstash-configured" | "override-acknowledged" }
  | { ok: false; reason: "production-without-shared-store"; message: string }

function hasUpstash(env: RateLimitEnv): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
}

function hasRedis(env: RateLimitEnv): boolean {
  return Boolean(env.REDIS_URL)
}

export function checkRateLimitBackend(env: RateLimitEnv): RateLimitSafeguardResult {
  if (env.NODE_ENV !== "production") {
    return { ok: true, reason: "not-production" }
  }
  if (hasUpstash(env)) return { ok: true, reason: "upstash-configured" }
  if (hasRedis(env)) return { ok: true, reason: "redis-configured" }
  if (env[RATELIMIT_OVERRIDE] === RATELIMIT_OVERRIDE_TOKEN) {
    return { ok: true, reason: "override-acknowledged" }
  }

  return {
    ok: false,
    reason: "production-without-shared-store",
    message:
      "FATAL: production boot without a shared rate-limit store. " +
      "The in-memory limiter scales with replicas — an attacker gets N×limit " +
      "behind a load balancer, neutralising every cap. " +
      "Set REDIS_URL (self-hosted) or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash). " +
      `For a deliberate single-instance deployment set ${RATELIMIT_OVERRIDE}="${RATELIMIT_OVERRIDE_TOKEN}".`,
  }
}
