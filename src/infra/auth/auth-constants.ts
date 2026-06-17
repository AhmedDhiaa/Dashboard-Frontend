/**
 * Auth Constants
 *
 * Single source of truth for authentication-related configuration constants
 * shared across middleware, route guards, the NextAuth jwt callback, and the
 * API client.
 *
 * @module infra/auth/auth-constants
 */

// ─── Public Paths ────────────────────────────────────────────────────────────

/** Routes that do not require authentication (used by client-side guards) */
export const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/session-expired",
  "/403",
  "/404",
] as const

/**
 * Routes that bypass middleware auth entirely (includes API, static assets).
 *
 * "Bypass middleware auth" means the page-route auth-cookie check + the
 * locale-injection logic don't run for these paths. The route handlers
 * themselves still enforce authn/authz (`requirePermission`, `auth()`).
 *
 * The /api/admin and /api/runtime entries are bypassed for the same
 * reason /api/auth is: redirecting an unauthenticated JSON API request
 * to /auth/login would surface as a parse error in the client, not a
 * useful 401. The Task B4 rate-limit step runs BEFORE the bypass check
 * in middleware.ts, so adding routes here doesn't weaken the limiter.
 */
export const MIDDLEWARE_BYPASS_PATHS = [
  ...PUBLIC_PATHS,
  "/api/auth",
  "/api/admin",
  "/api/runtime",
  "/_next",
  "/favicon.ico",
] as const

/** Check if a pathname matches a public (no-auth) route */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path))
}

/** Check if a pathname should bypass middleware authentication */
export function isMiddlewareBypassPath(pathname: string): boolean {
  return MIDDLEWARE_BYPASS_PATHS.some(path => pathname.startsWith(path))
}

// ─── Token Timing ────────────────────────────────────────────────────────────

/** Seconds before actual expiry to consider a token "expired" (server-side JWT callback) */
export const TOKEN_REFRESH_BUFFER_SECONDS = 60

/** Default token lifetime fallback when backend doesn't provide expires_in */
export const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600

// ─── Session Lifetime ─────────────────────────────────────────────────────────

/** NextAuth JWT + session max age (8 hours) — matches a full workday */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

/** How often NextAuth updates the session JWT (1 hour) */
export const JWT_UPDATE_AGE_SECONDS = 60 * 60

// ─── OAuth2 Network ───────────────────────────────────────────────────────────

/** AbortController timeout for OAuth2 token requests (ms) — prevents infinite hangs */
export const OAUTH2_REQUEST_TIMEOUT_MS = 20_000

/** Number of automatic retries on transient 5xx errors from the OAuth2 token endpoint */
export const OAUTH2_RETRY_ATTEMPTS = 1

/** Delay between OAuth2 retry attempts (ms) */
export const OAUTH2_RETRY_DELAY_MS = 1_000

// ─── Caching ─────────────────────────────────────────────────────────────────

/** Application configuration in-memory cache TTL (ms) */
export const APP_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000

// ─── Session Strategy ────────────────────────────────────────────────────────

/** NextAuth session strategy */
export const SESSION_STRATEGY = "jwt" as const

/**
 * SessionProvider refetch interval in seconds (0 = disabled).
 *
 * Was 5 min — fine for one user, but at N users it produces a sustained
 * N/(5·60) RPS load on /api/auth/session which fans out into the jwt
 * callback (cheap on warm token, ~8 s on a refresh). 15 min cuts that
 * load by 3×; window-focus refetch (below) still picks up token rotation
 * within seconds when the user actively switches tabs back to the app.
 */
export const SESSION_REFETCH_INTERVAL_SECONDS = 15 * 60 // 15 minutes

/** Refetch session when window regains focus */
export const SESSION_REFETCH_ON_WINDOW_FOCUS = true
