/**
 * Map Composer - Utility for composing and validating map configurations
 * Provides helpers for merging configs, applying presets, and validation
 */

import type { MapFeatures } from "../UnifiedMap"
import type { FeaturePreset } from "../features/FeaturePresets"
import { mergeWithPreset, validateFeatureDependencies } from "../features/FeaturePresets"
import { logger } from "@/shared/logger"

/**
 * Compose a complete map configuration from preset and overrides
 */
export function composeMapConfig(options: {
  preset?: FeaturePreset
  features?: Partial<MapFeatures>
  validate?: boolean
}): Partial<MapFeatures> {
  const { preset = "basic", features = {}, validate = true } = options

  // Merge preset with custom features
  const composed = mergeWithPreset(preset, features)

  // Validate if requested
  if (validate) {
    const warnings = validateFeatureDependencies(composed)
    if (warnings.length > 0) {
      warnings.forEach(warning => logger.warn(`[MapComposer] ${warning}`))
    }
  }

  return composed
}

/**
 * Deep merge two feature configurations
 */
export function mergeFeatureConfigs(base: Partial<MapFeatures>, override: Partial<MapFeatures>): Partial<MapFeatures> {
  const merged: Partial<MapFeatures> = { ...base }

  // Merge each feature type
  const featureKeys = ["markers", "boundaries", "drawing", "polylines"] as const

  featureKeys.forEach(key => {
    if (override[key]) {
      merged[key] = {
        ...base[key],
        ...override[key],
      } as Required<MapFeatures>[typeof key]
    }
  })

  return merged
}

/**
 * Extract enabled features from configuration
 */
export function getEnabledFeatures(config: Partial<MapFeatures>): string[] {
  const enabled: string[] = []

  if (config.markers?.enabled) enabled.push("markers")
  if (config.boundaries?.enabled) enabled.push("boundaries")
  if (config.drawing?.enabled) enabled.push("drawing")
  if (config.polylines?.enabled) enabled.push("polylines")

  return enabled
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(config: Partial<MapFeatures>, featureName: keyof MapFeatures): boolean {
  return config[featureName]?.enabled === true
}

/**
 * Optimize configuration for performance
 * Removes disabled features and applies best practices
 */
export function optimizeConfig(config: Partial<MapFeatures>): Partial<MapFeatures> {
  const optimized: Partial<MapFeatures> = {}

  // Only include enabled features
  if (config.markers?.enabled) {
    optimized.markers = config.markers
  }
  if (config.boundaries?.enabled) {
    optimized.boundaries = config.boundaries
  }
  if (config.drawing?.enabled) {
    optimized.drawing = config.drawing
  }
  if (config.polylines?.enabled) {
    optimized.polylines = config.polylines
  }

  return optimized
}

/**
 * Generate a configuration summary for debugging
 */
export function getConfigSummary(config: Partial<MapFeatures>): string {
  const enabled = getEnabledFeatures(config)

  if (enabled.length === 0) {
    return "No features enabled"
  }

  const details = enabled.map(feature => {
    const featureConfig = config[feature as keyof MapFeatures]
    let info = feature

    // Add specific details
    if (feature === "markers" && featureConfig && "markers" in featureConfig) {
      const markers = (featureConfig as Record<string, unknown>).markers as unknown[]
      if (Array.isArray(markers)) {
        info += ` (${markers.length} markers)`
      }
    }
    if (feature === "drawing" && featureConfig && "modes" in featureConfig) {
      const modes = (featureConfig as Record<string, unknown>).modes as unknown[]
      if (Array.isArray(modes)) {
        info += ` (${modes.join(", ")})`
      }
    }

    return info
  })

  return `Features: ${details.join(", ")}`
}
