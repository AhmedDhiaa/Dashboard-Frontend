/**
 * useMapCore - Core hook for map initialization and lifecycle management
 */

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { logger } from "@/shared/logger"
import { ProviderFactory } from "../providers/ProviderFactory"
import type { MapProvider, MapInstance } from "../providers/Provider.interface"
import type { MapOptions } from "../types"

/** Providers that render without any API key (free / open data). */
const KEYLESS_PROVIDERS = new Set(["leaflet"])

export interface UseMapCoreOptions {
  /** Container element ref */
  container: HTMLElement | null

  /** Provider name (default: 'google') */
  provider?: string

  /** API key */
  apiKey: string

  /** Map options */
  mapOptions: MapOptions

  /** Provider-specific libraries to load */
  libraries?: string[]
}

export interface UseMapCoreReturn {
  /** Map instance (null until ready) */
  map: MapInstance | null

  /** Provider instance */
  provider: MapProvider | null

  /** Loading state */
  isLoading: boolean

  /** Ready state */
  isReady: boolean

  /** Error state */
  error: Error | null

  /** Retry initialization */
  retry: () => void
}

/**
 * Core hook for map initialization
 */
export function useMapCore({
  container,
  provider: providerName = "google",
  apiKey,
  mapOptions,
  libraries = [],
}: UseMapCoreOptions): UseMapCoreReturn {
  const [map, setMap] = useState<MapInstance | null>(null)
  const [provider, setProvider] = useState<MapProvider | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const initAttemptRef = useRef(0)
  const hasInitializedRef = useRef(false)
  const isInitializingRef = useRef(false)

  const initialize = useCallback(async () => {
    if (!container) {
      logger.warn("[useMapCore] Container not ready")
      return
    }

    if (hasInitializedRef.current) {
      // If already initialized, we might still need to load libraries
      if (libraries.length > 0) {
        const providerInstance = ProviderFactory.getCachedProvider(providerName)
        if (providerInstance) {
          await providerInstance.initialize(apiKey, { libraries })
        }
      }
      return
    }

    // Guard against concurrent re-entry: React StrictMode double-mounts (and a
    // rapid deps change) can fire two initialize() calls before the first
    // resolves, which would create two maps on the same container — Leaflet
    // throws "Map container is already initialized" on the second.
    if (isInitializingRef.current) return
    isInitializingRef.current = true

    initAttemptRef.current++
    const attempt = initAttemptRef.current

    try {
      setIsLoading(true)
      setError(null)

      // Validate API key — only key-based providers (Google) need one. Key-less
      // providers (Leaflet/OpenStreetMap) initialize without any credentials.
      const needsApiKey = !KEYLESS_PROVIDERS.has(providerName.toLowerCase())
      if (needsApiKey && (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY" || apiKey.length < 20)) {
        throw new Error("Invalid or missing Google Maps API key. Please check your .env.local file.")
      }

      const providerInstance = await ProviderFactory.createProvider(providerName, apiKey)

      // Additional initialization for provider libraries
      if (libraries.length > 0) {
        await providerInstance.initialize(apiKey, { libraries })
      }

      setProvider(providerInstance)
      const mapInstance = providerInstance.createMap(container, mapOptions)
      setMap(mapInstance)
      setIsReady(true)
      setIsLoading(false)
      hasInitializedRef.current = true
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`[useMapCore] ❌ Initialization failed (attempt ${attempt}):`, error)
      logger.error(`[useMapCore] ❌ Error details:`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.split("\n").slice(0, 3).join("\n"),
        apiKeyPresent: !!apiKey,
        containerPresent: !!container,
      })
      setError(error)
      setIsLoading(false)
      setIsReady(false)
      hasInitializedRef.current = false
    } finally {
      isInitializingRef.current = false
    }
  }, [container, providerName, apiKey, mapOptions, libraries])

  // Initialize on mount or when dependencies change
  useEffect(() => {
    if (container) {
      if (!hasInitializedRef.current) {
        logger.info("[useMapCore] Container ready - initializing map")
      }
      initialize()
    }
  }, [container, initialize])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        logger.info("[useMapCore] Cleaning up map instance")
        map.destroy()
      }
    }
  }, [map])

  // Retry function
  const retry = useCallback(() => {
    hasInitializedRef.current = false
    initAttemptRef.current = 0
    setError(null)
    setIsLoading(true)
    initialize()
  }, [initialize])

  return {
    map,
    provider,
    isLoading,
    isReady,
    error,
    retry,
  }
}
