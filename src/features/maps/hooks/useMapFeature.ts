/**
 * useMapFeature Hook - Access and control individual map features
 * Provides a clean API for interacting with features from components
 */

import { useState, useEffect, useCallback } from "react"
import { useMapContext } from "../core/MapContext"
import { featureRegistry } from "../features/FeatureRegistry"
import { logger } from "@/shared/logger"
import type { BaseFeature, FeatureConfig } from "../features/Feature.interface"

export interface UseMapFeatureResult<TState = unknown> {
  /** Feature instance (null if not initialized) */
  feature: BaseFeature<FeatureConfig, TState> | null

  /** Whether feature is ready */
  isReady: boolean

  /** Whether feature is enabled */
  isEnabled: boolean

  /** Feature state data */
  state: TState | null

  /** Enable the feature */
  enable: () => void

  /** Disable the feature */
  disable: () => void

  /** Update feature configuration */
  update: (config: unknown) => void

  /** Get current feature state */
  getState: () => TState | null
}

/**
 * Hook to access and control a map feature
 *
 * Optimized to handle state synchronization safely
 */
export function useMapFeature<TState = unknown>(featureName: string): UseMapFeatureResult<TState> {
  const { map, isReady: mapReady } = useMapContext()
  const [feature, setFeature] = useState<BaseFeature<FeatureConfig, TState> | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [state, setState] = useState<TState | null>(null)

  // Initialize feature reference - suppressed as it's a bridge to external registry
  useEffect(() => {
    if (!mapReady || !map) {
      setIsReady(false)
      return
    }

    try {
      const instance = featureRegistry.getFeature(featureName) as BaseFeature<FeatureConfig, TState> | undefined

      if (instance) {
        setFeature(instance)
        setIsReady(true)
        setIsEnabled(instance.isEnabled())
        setState(instance.getData())
        logger.debug(`[useMapFeature] Connected: ${featureName}`)
      } else {
        setFeature(null)
        setIsReady(false)
      }
    } catch (error) {
      logger.error(`[useMapFeature] Connection failed: ${featureName}`, error)
      setFeature(null)
      setIsReady(false)
    }
  }, [featureName, mapReady, map])

  // Subscribe to feature state changes — pushed by BaseFeature whenever its
  // internal state mutates. Replaces the prior 1s polling.
  useEffect(() => {
    if (!feature) return

    const unsubscribe = feature.subscribe(data => {
      try {
        setState(data)
        setIsEnabled(feature.isEnabled())
      } catch (error) {
        logger.error(`[useMapFeature] Sync error: ${featureName}`, error)
      }
    })

    return unsubscribe
  }, [feature, featureName])

  const enable = useCallback(() => {
    if (!feature) return
    try {
      feature.enable()
      setIsEnabled(true)
    } catch (error) {
      logger.error(`[useMapFeature] Enable error: ${featureName}`, error)
    }
  }, [feature, featureName])

  const disable = useCallback(() => {
    if (!feature) return
    try {
      feature.disable()
      setIsEnabled(false)
    } catch (error) {
      logger.error(`[useMapFeature] Disable error: ${featureName}`, error)
    }
  }, [feature, featureName])

  const update = useCallback(
    (config: unknown) => {
      if (feature) feature.update(config as Partial<FeatureConfig>)
    },
    [feature],
  )

  const getState = useCallback(() => feature?.getData() ?? null, [feature])

  return {
    feature,
    isReady,
    isEnabled,
    state,
    enable,
    disable,
    update,
    getState,
  }
}

/**
 * Hook to access multiple features at once
 */
export function useMapFeatures(featureNames: string[]) {
  const context = useMapContext()

  const features = featureNames.reduce(
    (acc, name) => {
      const feature = featureRegistry.getFeature(name) as BaseFeature<FeatureConfig, unknown> | undefined
      const isReady = !!feature && context.isReady

      acc[name] = {
        feature: feature || null,
        isReady,
        isEnabled: feature?.isEnabled() ?? false,
        state: feature?.getData() ?? null,
        enable: () => feature?.enable(),
        disable: () => feature?.disable(),
        update: (config: unknown) => feature?.update(config as Partial<FeatureConfig>),
        getState: () => feature?.getData() ?? null,
      }
      return acc
    },
    {} as Record<string, UseMapFeatureResult>,
  )

  return {
    features,
    allReady: Object.values(features).every(f => f.isReady),
  }
}
