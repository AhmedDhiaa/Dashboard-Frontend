"use client"

import { useEffect, useRef, useState } from "react"
import { logger } from "@/shared/logger"
import { featureRegistry, BaseFeature } from "../features"
import type {
  MapInstance as ProviderMapInstance,
  MapProvider as MapProviderType,
} from "../providers/Provider.interface"
import type { MapFeatures } from "../UnifiedMap"

/**
 * Hook to manage feature initialization and updates
 */
export function useMapFeatures(
  map: ProviderMapInstance | null,
  mapProvider: MapProviderType | null,
  isReady: boolean,
  features: MapFeatures,
  onMapReady?: () => void,
  onMapError?: (error: Error) => void,
) {
  const [featuresInitialized, setFeaturesInitialized] = useState(false)
  const featureInstancesRef = useRef<Map<string, BaseFeature>>(new Map())

  // Initialize features when map is ready
  useEffect(() => {
    if (!isReady || !map || !mapProvider || featuresInitialized) return

    const featureInstances = featureInstancesRef.current

    const initializeFeatures = async () => {
      logger.info("[UnifiedMap] Initializing features...")

      try {
        for (const [featureName, featureConfig] of Object.entries(features)) {
          if (!featureConfig) continue

          if (!featureRegistry.isRegistered(featureName)) {
            logger.warn(`[UnifiedMap] Feature '${featureName}' not registered, skipping`)
            continue
          }

          logger.info(`[UnifiedMap] Initializing feature: ${featureName}`)

          const featureInstance = await featureRegistry.createFeature(featureName, map, featureConfig, mapProvider!)

          featureInstances.set(featureName, featureInstance as BaseFeature)
        }

        setFeaturesInitialized(true)
        onMapReady?.()
        logger.info("[UnifiedMap] ✅ All features initialized")
      } catch (err) {
        logger.error("[UnifiedMap] ❌ Feature initialization failed:", err)
        const error = err instanceof Error ? err : new Error(String(err))
        onMapError?.(error)
      }
    }

    initializeFeatures()

    return () => {
      logger.info("[UnifiedMap] Cleaning up features...")
      featureRegistry.destroyAll()
      featureInstances.clear()
      setFeaturesInitialized(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, map, mapProvider])

  // Update features when configuration changes
  useEffect(() => {
    if (!featuresInitialized) return

    const timeoutId = setTimeout(() => {
      logger.debug("[UnifiedMap] Updating feature configurations...")

      for (const [featureName, featureConfig] of Object.entries(features)) {
        if (!featureConfig) continue

        const instance = featureInstancesRef.current.get(featureName)
        if (instance && typeof instance.update === "function") {
          instance.update(featureConfig)
        }
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [features, featuresInitialized])

  return { featuresInitialized }
}
