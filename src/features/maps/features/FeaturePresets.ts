/**
 * Feature Presets - Pre-configured feature combinations for common use cases
 * Simplifies map configuration by providing ready-to-use setups
 */

import type { MapFeatures } from "../UnifiedMap"

export type FeaturePreset = "basic" | "tracking" | "area-management" | "full" | "minimal"

/**
 * Feature preset configurations
 */
export const FEATURE_PRESETS: Record<FeaturePreset, Partial<MapFeatures>> = {
  /**
   * Minimal - Just the map, no features
   */
  minimal: {},

  /**
   * Basic - Simple marker display with navigation
   */
  basic: {
    markers: {
      enabled: true,
      markers: [],
      fitBounds: true,
    },
  },

  /**
   * Tracking - Real-time tracking with markers and polylines
   */
  tracking: {
    markers: {
      enabled: true,
      markers: [],
      fitBounds: true,
    },
    polylines: {
      enabled: true,
      polylines: [],
    },
  },

  /**
   * Area Management - Boundary editing and drawing tools
   */
  "area-management": {
    boundaries: {
      enabled: true,
      editable: true,
      fillColor: "#3b82f6",
      strokeColor: "#1e40af",
      fillOpacity: 0.35,
      strokeWeight: 2,
    },
    drawing: {
      enabled: true,
      modes: ["polygon", "circle"],
      showControls: true,
      polygonOptions: {
        fillColor: "#3b82f6",
        strokeColor: "#1e40af",
        fillOpacity: 0.35,
        strokeWeight: 2,
      },
    },
  },

  /**
   * Full - All features enabled
   */
  full: {
    markers: {
      enabled: true,
      markers: [],
      fitBounds: true,
    },
    boundaries: {
      enabled: true,
      editable: true,
    },
    drawing: {
      enabled: true,
      modes: ["polygon", "circle"],
      showControls: true,
    },
    polylines: {
      enabled: true,
      polylines: [],
    },
  },
}

/**
 * Get feature configuration for a preset
 */
export function getPresetConfig(preset: FeaturePreset): Partial<MapFeatures> {
  return FEATURE_PRESETS[preset] || FEATURE_PRESETS.minimal
}

/**
 * Merge preset with custom configuration
 * Custom config takes precedence over preset
 */
export function mergeWithPreset(preset: FeaturePreset, customConfig: Partial<MapFeatures> = {}): Partial<MapFeatures> {
  const presetConfig = getPresetConfig(preset)

  return {
    ...presetConfig,
    ...customConfig,
    // Deep merge for nested configs
    markers: {
      ...presetConfig.markers,
      ...customConfig.markers,
    },
    boundaries: {
      ...presetConfig.boundaries,
      ...customConfig.boundaries,
    },
    drawing: {
      ...presetConfig.drawing,
      ...customConfig.drawing,
    },
    polylines: {
      ...presetConfig.polylines,
      ...customConfig.polylines,
    },
  }
}

/**
 * Validate feature dependencies
 * Returns array of missing dependencies
 */
export function validateFeatureDependencies(features: Partial<MapFeatures>): string[] {
  const warnings: string[] = []

  // Drawing feature requires boundaries to be useful
  if (features.drawing?.enabled && !features.boundaries?.enabled) {
    warnings.push(
      "Drawing feature is enabled but boundaries feature is disabled. Consider enabling boundaries to save drawn shapes.",
    )
  }

  return warnings
}

/**
 * Get recommended preset based on feature requirements
 */
export function getRecommendedPreset(requirements: {
  needsMarkers?: boolean
  needsBoundaries?: boolean
  needsDrawing?: boolean
  needsTracking?: boolean
}): FeaturePreset {
  const { needsMarkers, needsBoundaries, needsDrawing, needsTracking } = requirements

  if (needsDrawing || needsBoundaries) {
    return "area-management"
  }

  if (needsTracking) {
    return "tracking"
  }

  if (needsMarkers) {
    return "basic"
  }

  return "minimal"
}
