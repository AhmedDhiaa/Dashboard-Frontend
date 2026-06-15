/**
 * Map Context - React context for map system
 * Provides access to map instance, provider, and event bus throughout the component tree
 */

"use client"

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react"
import { logger } from "@/shared/logger"
import type { MapInstance } from "../providers/Provider.interface"
import type { MapProvider } from "../providers/Provider.interface"
import { EventBus } from "./EventBus"
import { featureRegistry } from "../features/FeatureRegistry"

/**
 * Map context value
 */
export interface MapContextValue {
  /** Map instance (null until initialized) */
  map: MapInstance | null

  /** Map provider */
  provider: MapProvider | null

  /** Event bus for feature communication */
  eventBus: EventBus

  /** Whether map is ready */
  isReady: boolean

  /** Error if initialization failed */
  error: Error | null
}

/**
 * Map context
 */
const MapContext = createContext<MapContextValue | null>(null)

/**
 * Hook to access map context
 */
export function useMapContext(): MapContextValue {
  const context = useContext(MapContext)

  if (!context) {
    throw new Error("useMapContext must be used within MapProvider")
  }

  return context
}

/**
 * Hook to access map instance (throws if not ready)
 */
export function useMap(): MapInstance {
  const { map, isReady } = useMapContext()

  if (!isReady || !map) {
    throw new Error("Map not ready. Check isReady before using useMap()")
  }

  return map
}

/**
 * Hook to access event bus
 */
export function useMapEvents(): EventBus {
  const { eventBus } = useMapContext()
  return eventBus
}

/**
 * Map Provider Props
 */
interface MapProviderProps {
  map: MapInstance | null
  provider: MapProvider | null
  children: ReactNode
}

/**
 * Map Provider Component
 * Provides map context to child components
 */
export function MapProvider({ map, provider, children }: MapProviderProps) {
  const [error] = useState<Error | null>(null)
  const [eventBus] = useState(() => new EventBus())

  // Derive readiness from props
  const isReady = !!map && !!provider

  useEffect(() => {
    if (isReady) {
      logger.info("[MapContext] Map is ready")
    }
  }, [isReady])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.info("[MapContext] Cleaning up")
      eventBus.clear()
      featureRegistry.destroyAll()
    }
  }, [eventBus])

  const value: MapContextValue = useMemo(
    () => ({
      map,
      provider,
      eventBus,
      isReady,
      error,
    }),
    [map, provider, isReady, error, eventBus],
  )

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}
