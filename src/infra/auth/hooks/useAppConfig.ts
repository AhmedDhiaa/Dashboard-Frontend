/**
 * Application Configuration Hook
 *
 * Fetches and caches ABP application-configuration from the API.
 * Provides fresh grantedPolicies, settings, and features to the entire app.
 *
 * Features:
 * - In-memory cache with 5-min TTL (shared via application-config.service)
 * - Refresh on window focus (only if stale)
 * - Exposes `refreshConfig()` for manual invalidation
 * - Single inflight request deduplication (handled by service layer)
 *
 * @module infra/auth/hooks/useAppConfig
 */

"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useSession } from "next-auth/react"
import { fetchApplicationConfiguration, invalidateAppConfigCache } from "@/infra/auth/application-config.service"
import { APP_CONFIG_CACHE_TTL_MS } from "@/infra/auth/auth-constants"
import type { ApplicationConfiguration } from "@/shared/types/application-config.types"
import { logger } from "@/shared/logger"

// ─── Shared state across all hook consumers ──────────────────────────────────

let _sharedConfig: ApplicationConfiguration | null = null
let _sharedTimestamp = 0
const _listeners = new Set<() => void>()

function notifyListeners() {
  _listeners.forEach(fn => fn())
}

/** Global getter for permission checks outside React (e.g., middleware, guards) */
export function getAppConfig(): ApplicationConfiguration | null {
  return _sharedConfig
}

/** Get cached grantedPolicies keys as string array */
export function getCachedPermissions(): string[] {
  if (!_sharedConfig) return []
  const policies = _sharedConfig.auth?.grantedPolicies ?? {}
  return Object.keys(policies).filter(k => policies[k])
}

/** Check a single permission against cached config (non-React) */
export function isPermissionGrantedCached(permission: string): boolean {
  if (!_sharedConfig) return false
  return _sharedConfig.auth?.grantedPolicies?.[permission] === true
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface AppConfigState {
  config: ApplicationConfiguration | null
  permissions: string[]
  settings: Record<string, string>
  features: Record<string, string>
  isLoading: boolean
  error: Error | null
  /** Force-refresh from API (bypasses cache) */
  refreshConfig: () => Promise<void>
}

export function useAppConfig(): AppConfigState {
  const { status } = useSession()
  const [, forceUpdate] = useState(0)
  const [isLoading, setIsLoading] = useState(!_sharedConfig)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  // Subscribe to shared state changes
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    _listeners.add(listener)
    return () => {
      _listeners.delete(listener)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Fetch config (shared logic)
  const loadConfig = useCallback(
    async (force: boolean = false) => {
      // Don't fetch if not authenticated
      if (status !== "authenticated") return

      // Skip if cache is still fresh and not forced
      if (!force && _sharedConfig && Date.now() - _sharedTimestamp < APP_CONFIG_CACHE_TTL_MS) {
        return
      }

      try {
        if (mountedRef.current) setIsLoading(true)
        const data = await fetchApplicationConfiguration(false, force)

        _sharedConfig = data
        _sharedTimestamp = Date.now()
        if (mountedRef.current) setError(null)
        notifyListeners()
      } catch (err) {
        // Gracefully handle failures (e.g. 404 when endpoint is unavailable)
        // The system falls back to session-frozen permissions, so this is non-fatal
        const status = (err as { status?: number })?.status
        if (status === 404) {
          logger.warn("useAppConfig: endpoint not found (404), using session permissions")
        } else {
          logger.error("useAppConfig: failed to fetch config", err)
        }
        if (mountedRef.current) setError(err as Error)
      } finally {
        if (mountedRef.current) setIsLoading(false)
      }
    },
    [status],
  )

  // Initial fetch when authenticated
  useEffect(() => {
    if (status === "authenticated") {
      loadConfig()
    }
  }, [status, loadConfig])

  // Refresh on window focus (only if stale)
  useEffect(() => {
    if (typeof window === "undefined") return

    const handleFocus = () => {
      if (status === "authenticated" && (!_sharedConfig || Date.now() - _sharedTimestamp > APP_CONFIG_CACHE_TTL_MS)) {
        loadConfig()
      }
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [status, loadConfig])

  // Derive permissions / settings / features from `_sharedConfig`. Memoized
  // against the config reference so consumer hooks (PermissionContext) don't
  // see a fresh array/object every render — that fresh-reference cascade was
  // forcing a Set rebuild on every render of every component that ever
  // consumed `usePermissionContext()`.
  //
  // `_sharedConfig` is module-level state. ESLint's exhaustive-deps rule flags
  // it as "outer scope" because mutating a module-level binding doesn't on its
  // own re-render React. The flow that DOES drive re-renders is intact:
  // `loadConfig` reassigns `_sharedConfig`, then `notifyListeners()` fires the
  // `forceUpdate` setter on every subscriber, and that re-render re-evaluates
  // the memo with the new reference. So the memo IS correct — the rule just
  // doesn't model module-level state.
  /* eslint-disable react-hooks/exhaustive-deps */
  const permissions = useMemo<string[]>(() => {
    if (!_sharedConfig) return []
    const policies = _sharedConfig.auth?.grantedPolicies ?? {}
    return Object.keys(policies).filter(k => policies[k])
  }, [_sharedConfig])

  const settings = useMemo<Record<string, string>>(() => _sharedConfig?.setting?.values ?? {}, [_sharedConfig])

  const features = useMemo<Record<string, string>>(() => _sharedConfig?.features?.values ?? {}, [_sharedConfig])
  /* eslint-enable react-hooks/exhaustive-deps */

  const refreshConfig = useCallback(async () => {
    invalidateAppConfigCache()
    await loadConfig(true)
  }, [loadConfig])

  return {
    config: _sharedConfig,
    permissions,
    settings,
    features,
    // Never block the app — loading is only true during the initial fetch
    // and becomes false once the fetch completes (success or failure)
    isLoading: isLoading && !_sharedConfig && !error,
    error,
    refreshConfig,
  }
}
