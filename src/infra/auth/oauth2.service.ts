/**
 * OAuth2 Authentication Service
 *
 * Provides OAuth2 password grant and refresh token flows.
 * This is the single source of truth for authentication token management.
 *
 * Improvements:
 * - All requests have an AbortController timeout (OAUTH2_REQUEST_TIMEOUT_MS)
 *   to prevent the UI hanging indefinitely when the API is unreachable.
 * - Transient 5xx server errors are retried once (OAUTH2_RETRY_ATTEMPTS)
 *   with a short delay (OAUTH2_RETRY_DELAY_MS) before propagating the error.
 *
 * @module services/auth/oauth2.service
 */

import { config } from "@/shared/config"
import type {
  AuthTokenResponse as TokenResponse,
  AuthLoginRequest as LoginRequest,
  AuthRefreshTokenRequest as RefreshTokenRequest,
} from "@/shared/types"
import { OAUTH2_REQUEST_TIMEOUT_MS, OAUTH2_RETRY_ATTEMPTS, OAUTH2_RETRY_DELAY_MS } from "./auth-constants"
import { IS_MOCK } from "@/infra/api/mock"
import { sleep } from "@/shared/utils/general"
import { mockTokenResponse } from "@/infra/api/mock/handlers/auth"

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * OAuth2 Client Configuration getter to ensure environment variables are loaded.
 *
 * URL resolution priority (server-side calls):
 *  1. API_URL        — private/internal URL for server-side Node.js (no hairpin NAT)
 *  2. config.api.baseUrl / NEXT_PUBLIC_API_URL — public URL (browser and fallback)
 *
 * This two-URL pattern prevents "fetch failed" when the Next.js server and the
 * API backend are on the same network and the public hostname cannot be resolved
 * from within that network (common on IIS, Docker, and cloud deployments).
 */
function getOauth2Config() {
  const serverApiUrl = process.env.API_URL // internal URL — server-side only
  const publicApiUrl = config.api.baseUrl || process.env.NEXT_PUBLIC_API_URL || ""
  const baseUrl = (serverApiUrl || publicApiUrl).replace(/\/$/, "")
  const tokenPath = (config.api.oauth2.tokenUrl || "/connect/token").replace(/^\/?/, "/")
  return {
    tokenUrl: `${baseUrl}${tokenPath}`,
    clientId: config.api.oauth2.clientId,
    scope: config.api.oauth2.scope,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates form-urlencoded request body for OAuth2 token requests
 */
function createFormData(data: Record<string, string>): string {
  const formData = new URLSearchParams()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData.toString()
}

/**
 * Fetch with timeout using AbortController.
 * Will abort and throw if the request exceeds `timeoutMs`.
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`OAuth2 request timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch with timeout + automatic retry on transient HTTP 5xx errors only.
 * - 4xx errors (invalid_grant) are NOT retried — they are auth failures.
 * - Network-level errors (ECONNREFUSED, DNS, TLS) are NOT retried — if the
 *   server is unreachable, a 1-second delay will not fix it. Fail fast.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  maxRetries: number,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(OAUTH2_RETRY_DELAY_MS)
    }

    // Network-level errors propagate immediately — no retry
    const response = await fetchWithTimeout(url, options, timeoutMs)

    // Retry only on HTTP 5xx (transient server errors)
    if (response.status >= 500 && attempt < maxRetries) {
      continue
    }

    return response
  }

  // unreachable, but TypeScript requires an explicit return/throw after a loop
  throw new Error("OAuth2 request failed")
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Request access token using OAuth2 password grant flow
 *
 * @param credentials - User login credentials
 * @returns Token response with access_token and refresh_token
 * @throws Error if authentication fails
 *
 * @example
 * ```ts
 * const tokens = await login({ username: 'user123', password: 'pass123' })
 * // { access_token: '...', refresh_token: '...', expires_in: 3600 }
 * ```
 */
export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  // Standalone mock mode: any non-empty credentials succeed (demo/demo is the
  // documented pair). Returns a stable fake token bundle — no network call.
  if (IS_MOCK) {
    const username = credentials.username || credentials.email || ""
    if (!username || !credentials.password) {
      throw new Error("invalid_grant")
    }
    return mockTokenResponse() as TokenResponse
  }

  const oauth2Config = getOauth2Config()
  const formData = createFormData({
    grant_type: "password",
    username: credentials.username || credentials.email || "",
    password: credentials.password,
    client_id: oauth2Config.clientId,
    scope: oauth2Config.scope,
  })

  const requestOptions: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: formData,
  }

  const response = await fetchWithRetry(
    oauth2Config.tokenUrl,
    requestOptions,
    OAUTH2_REQUEST_TIMEOUT_MS,
    OAUTH2_RETRY_ATTEMPTS,
  )

  if (!response.ok) {
    let errorMessage = "Login failed"
    try {
      const error = await response.json()
      errorMessage = error.error_description || error.error || errorMessage
    } catch {
      errorMessage = `Server error: ${response.status} ${response.statusText}`
    }
    throw new Error(errorMessage)
  }

  return await response.json()
}

/**
 * Refresh access token using refresh token
 *
 * @param request - Refresh token request containing refresh_token
 * @returns New token response with updated access_token
 * @throws Error if refresh fails (e.g., refresh token expired)
 *
 * @example
 * ```ts
 * const newTokens = await refreshToken({ refresh_token: 'old_refresh_token' })
 * // { access_token: 'new_access_token', refresh_token: 'new_refresh_token', ... }
 * ```
 */
export async function refreshToken(request: RefreshTokenRequest): Promise<TokenResponse> {
  // Standalone mock mode: re-issue the same fake token bundle. The session
  // never truly expires offline.
  if (IS_MOCK) {
    return mockTokenResponse() as TokenResponse
  }

  const oauth2Config = getOauth2Config()
  const formData = createFormData({
    grant_type: "refresh_token",
    refresh_token: request.refresh_token,
    client_id: oauth2Config.clientId,
  })

  const requestOptions: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: formData,
  }

  // Refresh token requests: no retry — a 4xx (invalid_grant) means the session is truly expired
  const response = await fetchWithTimeout(oauth2Config.tokenUrl, requestOptions, OAUTH2_REQUEST_TIMEOUT_MS)

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "invalid_request",
      error_description: "Failed to parse error response",
    }))
    throw new Error(error.error_description || error.error || "Token refresh failed")
  }

  return await response.json()
}
