/**
 * Application Configuration Service
 *
 * Fixes applied:
 * - [CRITICAL] Invalidation safety: a _cacheToken prevents a stale in-flight
 *   request from overwriting a freshly-invalidated cache.
 * - De-duplication of concurrent calls is preserved.
 *
 * @module infra/auth/application-config.service
 */

import { apiClient } from "@/infra/api"
import type { ApplicationConfiguration } from "@/shared/types/application-config.types"
import { logger } from "@/shared/logger"
import { APP_CONFIG_CACHE_TTL_MS } from "./auth-constants"

// ─── In-memory cache ─────────────────────────────────────────────────────────

interface ConfigCache {
  data: ApplicationConfiguration
  timestamp: number
}

let _cache: ConfigCache | null = null
let _inflightRequest: Promise<ApplicationConfiguration> | null = null

/**
 * Monotonically-incrementing token. Every invalidation increments it.
 * An in-flight request captures the token at launch; if the token has
 * changed by the time the request resolves, the result is discarded.
 */
let _cacheToken = 0

/** Invalidate the cached application configuration (thread-safe). */
export function invalidateAppConfigCache(): void {
  _cache = null
  _inflightRequest = null
  _cacheToken++
}

/**
 * Fetch application configuration from the server.
 *
 * - Returns cached data if still within TTL.
 * - De-duplicates concurrent calls: only one network request in flight at a time.
 * - Invalidation-safe: if invalidateAppConfigCache() is called while a fetch
 *   is in progress, the result of that fetch is discarded and the next caller
 *   starts a fresh request.
 */
export async function fetchApplicationConfiguration(
  includeLocalizationResources: boolean = false,
  forceRefresh: boolean = false,
): Promise<ApplicationConfiguration> {
  // Return cached data if still fresh
  if (!forceRefresh && _cache && Date.now() - _cache.timestamp < APP_CONFIG_CACHE_TTL_MS) {
    return _cache.data
  }

  // De-duplicate in-flight requests
  if (_inflightRequest && !forceRefresh) {
    return _inflightRequest
  }

  // Capture the current token so we can detect post-resolve invalidation
  const tokenAtLaunch = ++_cacheToken

  _inflightRequest = (async () => {
    try {
      const response = await apiClient.get<ApplicationConfiguration>("/api/abp/application-configuration", {
        params: { IncludeLocalizationResources: includeLocalizationResources },
      })

      const data = response.data

      // Only write to cache if no invalidation occurred while we were fetching
      if (_cacheToken === tokenAtLaunch) {
        _cache = { data, timestamp: Date.now() }
        logger.info("Application configuration cached", {
          userId: data.currentUser?.id,
          userName: data.currentUser?.userName,
          roles: data.currentUser?.roles,
          isAuthenticated: data.currentUser?.isAuthenticated,
        })
      } else {
        logger.warn("App config fetch completed after invalidation — result discarded")
      }

      return data
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } }
      const status = axiosError?.response?.status

      if (status === 401 || status === 403) {
        logger.warn("App config fetch returned auth error", { status })
      } else {
        logger.error("Failed to fetch application configuration", error)
      }
      throw error
    } finally {
      // Release the de-duplication lock
      _inflightRequest = null
    }
  })()

  return _inflightRequest
}
