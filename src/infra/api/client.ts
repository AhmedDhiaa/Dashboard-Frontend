/**
 * Centralized API Client with Axios
 *
 * Provides authenticated HTTP client with automatic token management,
 * request/response interceptors, error handling, retry logic, and token refresh
 */

import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from "axios"
import { config } from "@/shared/config"
import { logger } from "@/shared/logger"
import { logApiError, createErrorFromResponse, handleErrorRedirects } from "./error-handling"
import { getSafePath } from "@/shared/utils/url"
import { isPublicPath } from "@/infra/auth/auth-constants"
import { generateCorrelationId } from "@/shared/utils/correlation"
import { errorReporter } from "@/infra/observability/error-reporter"
import type { ExtendedSession } from "@/shared/types"
import { IS_MOCK } from "./mock"

// ─── Lazy, memoized module references ────────────────────────────────────────
// next-auth/react and the server auth helper are dynamically imported so the
// server-only `auth()` call doesn't leak into the client bundle.
let nextAuthReactPromise: Promise<typeof import("next-auth/react")> | null = null
const getNextAuthReact = () => {
  if (!nextAuthReactPromise) nextAuthReactPromise = import("next-auth/react")
  return nextAuthReactPromise
}

let sharedConfigPromise: Promise<typeof import("@/shared/config")> | null = null
const getSharedConfig = () => {
  if (!sharedConfigPromise) sharedConfigPromise = import("@/shared/config")
  return sharedConfigPromise
}

let serverAuthPromise: Promise<typeof import("@/infra/auth")> | null = null
const getServerAuth = () => {
  if (!serverAuthPromise) serverAuthPromise = import("@/infra/auth")
  return serverAuthPromise
}

// Read the access token straight from the NextAuth session. Calling
// `getSession()` re-runs the server-side `jwt` callback, which is the only
// place tokens are refreshed. There is no parallel client refresh path.
//
// `getSession()` hits `/api/auth/session` on every call. A data-heavy page
// firing N parallel XHRs would otherwise serialize N identical session
// round-trips in front of its requests. We guard that two ways:
//   • in-flight dedupe — concurrent callers share one `getSession()` promise;
//   • a short TTL cache — sequential callers within `SESSION_CACHE_TTL_MS`
//     reuse the last result. The window is tiny relative to the token's 8 h
//     lifetime and 60 s pre-expiry refresh buffer, so it can never serve a
//     token that should already have been refreshed.
// The 401 retry path passes `{ force: true }` to bypass both and pull a
// freshly-refreshed token from the jwt callback.
type SessionToken = { token: string | null; error: string | undefined }

const SESSION_CACHE_TTL_MS = 3_000
let cachedSessionToken: { value: SessionToken; at: number } | null = null
let inflightSessionToken: Promise<SessionToken> | null = null

async function getSessionAccessToken({ force = false }: { force?: boolean } = {}): Promise<SessionToken> {
  if (force) {
    cachedSessionToken = null
    inflightSessionToken = null
  } else {
    if (cachedSessionToken && Date.now() - cachedSessionToken.at < SESSION_CACHE_TTL_MS) {
      return cachedSessionToken.value
    }
    if (inflightSessionToken) return inflightSessionToken
  }

  const fetchToken = (async (): Promise<SessionToken> => {
    const { getSession } = await getNextAuthReact()
    const session = (await getSession()) as ExtendedSession | null
    const value: SessionToken = { token: session?.accessToken ?? null, error: session?.error }
    cachedSessionToken = { value, at: Date.now() }
    return value
  })()

  if (!force) inflightSessionToken = fetchToken
  try {
    return await fetchToken
  } finally {
    if (inflightSessionToken === fetchToken) inflightSessionToken = null
  }
}

/**
 * Forward a network error to the centralized error reporter with structured
 * tags + extra context. Lifted out of the response interceptor to keep the
 * interceptor's cyclomatic complexity within the project ceiling.
 */
function reportApiError(
  error: AxiosError<{ message?: string; errors?: unknown; resource?: string }>,
  appError: import("./errors").AppError,
): void {
  errorReporter.captureException(appError, {
    correlationId: error.config?.metadata?.correlationId,
    tags: {
      method: error.config?.method?.toUpperCase() ?? "UNKNOWN",
      status: String(error.response?.status ?? "network"),
    },
    extra: {
      url: error.config?.url,
      responseData: error.response?.data,
    },
  })
}

// Create axios instance with default config
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? config.api.baseUrl
  }
  return config.api.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? ""
}

const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: config.api.timeout,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
})

// ─── Standalone mock mode ─────────────────────────────────────────────────────
// When NEXT_PUBLIC_USE_MOCK_API === "true", swap axios's network adapter for the
// in-memory mock adapter. Every request is then answered from seeded data and
// the app runs with NO backend. Interceptors below still run (auth header,
// logging) — they just operate on mock responses. When the flag is off/unset
// this block is skipped and behaviour is identical to the real backend.
//
// The real `mockAdapter` is loaded via a DYNAMIC import: it transitively pulls
// in the entity-config registry (and the CLIENT modules that registry imports,
// e.g. `useEnum` → useEffect). Importing it statically would drag those client
// modules into the server graph (this file is the universal client, reachable
// from `server.ts`) and make Turbopack 500 every route. To avoid a race where
// an early request fires before the dynamic import resolves, we install a thin
// wrapper adapter synchronously; on first call it awaits the real adapter
// (memoized) and delegates to it. Mock mode is browser-only in practice, where
// dynamic-importing client modules is allowed.
if (IS_MOCK) {
  let realMockAdapterPromise: Promise<import("axios").AxiosAdapter> | null = null
  const loadMockAdapter = (): Promise<import("axios").AxiosAdapter> => {
    if (!realMockAdapterPromise) realMockAdapterPromise = import("./mock/adapter").then(m => m.mockAdapter)
    return realMockAdapterPromise
  }
  // Synchronous wrapper so the adapter is in place before any request runs.
  apiClient.defaults.adapter = async config => {
    const adapter = await loadMockAdapter()
    return adapter(config)
  }
  logger.info("[API] Mock mode enabled — all requests are served from seeded in-memory data")
}

// Request interceptor - Add auth token and setup headers
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const startTime = Date.now()

    // Store start time + correlation ID for the lifetime of this request.
    // The correlation ID flows through three places:
    //   1. The `x-correlation-id` request header — backend can echo + log it.
    //   2. Every log line emitted from the response/error interceptors below.
    //   3. The thrown AppError, so user-facing messages can quote the ID.
    if (!config.metadata) {
      config.metadata = {}
    }
    config.metadata.startTime = startTime
    const correlationId = generateCorrelationId()
    config.metadata.correlationId = correlationId
    config.headers["x-correlation-id"] = correlationId

    // Get access token from the NextAuth session. The server-side jwt
    // callback refreshes the token transparently if it's near expiry — this
    // interceptor never initiates a refresh on its own.
    if (typeof window !== "undefined") {
      try {
        const { token, error: sessionError } = await getSessionAccessToken()
        if (token && !sessionError) {
          config.headers.Authorization = `Bearer ${token}`
        } else {
          const currentPath = window.location.pathname
          if (!isPublicPath(currentPath)) {
            logger.warn("No valid access token for protected route, redirecting to login")
            const safePath = getSafePath(currentPath)
            window.location.href = `/auth/login?redirectTo=${encodeURIComponent(safePath)}`
            return Promise.reject(new Error("No valid access token"))
          }
        }
      } catch (error) {
        logger.error("Failed to get access token", error)
      }

      // Add locale header — use centralized locale utility
      const { getLocaleFromCookie, DEFAULT_LOCALE } = await getSharedConfig()
      const locale = getLocaleFromCookie() || DEFAULT_LOCALE
      config.headers["Accept-Language"] = locale
    } else {
      // Server-side: pull token from server auth helper
      try {
        const { getAccessToken } = await getServerAuth()
        const accessToken = await getAccessToken()
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`
        }
      } catch {
        // Silently fail on server-side
      }
    }

    // Log request with metadata + correlation ID
    logger.info(`→ ${config.method?.toUpperCase()} ${config.url}`, {
      correlationId,
      method: config.method?.toUpperCase(),
      url: config.url,
      params: config.params,
      timestamp: new Date().toISOString(),
    })

    return config
  },
  (error: AxiosError) => {
    const correlationId = error.config?.metadata?.correlationId
    logger.error(`REQUEST ERROR: ${error.config?.url}`, { correlationId, error })
    return Promise.reject(error)
  },
)

// ─── Response interceptor ordering ────────────────────────────────────────────
//
// Axios runs response interceptors in **registration order** (FIFO) on both
// success and error paths. Each interceptor's `onRejected` only fires if the
// previous one re-rejects; if a previous interceptor recovers (returns a
// resolved promise) the next one's `onRejected` is skipped and `onFulfilled`
// runs instead.
//
// The two interceptors below are sequenced as:
//   1. **Refresh** — must run first on errors, so 401/403 gets a chance to
//      refresh the token and re-issue the request before any other handler
//      sees the failure.
//   2. **Retry** (transient 5xx/408/429) — runs after refresh and explicitly
//      skips 401/403 so an auth failure can never accidentally trigger a
//      naive retry without a fresh token.
//
// Do not insert new error-side interceptors between them, and do not let the
// retry interceptor's `RETRYABLE_CODES` list grow to include 401/403 — see the
// explicit guard in that handler.
//
// ── Refresh interceptor ──────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate request duration
    const startTime = response.config.metadata?.startTime
    const duration = startTime ? Date.now() - startTime : undefined
    const correlationId = response.config.metadata?.correlationId

    // Log successful response with timing + correlation ID
    logger.info(`← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      correlationId,
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      duration: duration ? `${duration}ms` : undefined,
      timestamp: new Date().toISOString(),
    })

    return response
  },
  async (error: AxiosError<{ message?: string; errors?: unknown; resource?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // 401 → ask NextAuth for the session again. The server-side jwt
    // callback re-evaluates `expires_at`, runs the OAuth refresh grant if
    // needed, and returns a fresh access token. Concurrent 401s end up
    // sharing a single refresh because the jwt callback dedups in-flight
    // refreshes by refresh_token. We retry once; if the second token is
    // still missing or the session reports RefreshAccessTokenError, the
    // error falls through to handleErrorRedirects → login redirect.
    //
    // 403 is deliberately NOT refreshed: in ABP a 403 means the
    // *authenticated* user lacks the permission, so a fresh token returns
    // the identical 403. Refreshing would only add a session round-trip and
    // a wasted request replay before the same failure. Let 403 fall straight
    // through to handleErrorRedirects → /403.
    if (
      typeof window !== "undefined" &&
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true

      try {
        const { token: newToken, error: sessionError } = await getSessionAccessToken({ force: true })
        if (newToken && !sessionError && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        logger.error("Session refresh failed during 401 retry", refreshError)
      }
    }

    // Log error with full context (correlation ID included via extractErrorContext)
    logApiError(error)

    // Create appropriate error from response and stamp it with the
    // correlation ID so user-visible toasts can quote it for support.
    const appError = createErrorFromResponse(error)
    appError.correlationId = error.config?.metadata?.correlationId

    // Forward to the centralized error reporter — Sentry/Datadog hooks here.
    reportApiError(error, appError)

    // Handle redirects for auth errors
    await handleErrorRedirects(appError)

    throw appError
  },
)

export { apiClient }

// ─── Retry interceptor for transient failures ─────────────────────────────────
//
// Registered AFTER the refresh interceptor on purpose — see the ordering
// comment above. Auth failures (401/403) belong to the refresh interceptor;
// this handler must never retry them, because retrying a 401 without a fresh
// token just produces another 401 and burns the user's grace.

const MAX_RETRIES = 3
const RETRYABLE_CODES = [408, 429, 500, 502, 503, 504]

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const retryConfig = error.config as InternalAxiosRequestConfig & { _retryCount?: number }

    // Only retry GET requests (idempotent)
    if (error.config?.method?.toUpperCase() !== "GET") return Promise.reject(error)

    const status = error.response?.status

    // Auth errors are the refresh interceptor's territory — never retry them
    // here. This is belt-and-suspenders: 401/403 are also not in
    // RETRYABLE_CODES, but the explicit early-out makes the rule load-bearing
    // even if someone later edits that array.
    if (status === 401 || status === 403) return Promise.reject(error)

    if (!status || !RETRYABLE_CODES.includes(status)) return Promise.reject(error)

    retryConfig._retryCount = (retryConfig._retryCount ?? 0) + 1
    if (retryConfig._retryCount > MAX_RETRIES) return Promise.reject(error)

    // Exponential backoff: 500ms, 1000ms, 2000ms
    const delay = Math.pow(2, retryConfig._retryCount - 1) * 500
    await new Promise(resolve => setTimeout(resolve, delay))

    logger.warn(`[API] Retrying request (attempt ${retryConfig._retryCount}/${MAX_RETRIES})`, {
      url: retryConfig.url,
      status,
    })

    return apiClient(retryConfig)
  },
)

/**
 * Paginated response structure from ABP backend
 */
export interface PaginatedResponse<T> {
  items: T[]
  totalCount: number
}

/**
 * Helper function to build query parameters
 */
export function buildQueryParams(params: Record<string, unknown>): URLSearchParams {
  const queryParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value))
    }
  })

  return queryParams
}
