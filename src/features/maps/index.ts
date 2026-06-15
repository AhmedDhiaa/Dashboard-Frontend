// Main component
export { UnifiedMap } from "./UnifiedMap"
export type { UnifiedMapProps, MapFeatures } from "./UnifiedMap"

// UI Components
export { SearchControl } from "./ui/SearchControl"
export { SearchSuggestions } from "./components/SearchSuggestions"
export type { SearchControlConfig, SearchResult, SearchType, ControlPosition } from "./ui/SearchControl"
export { MapControls } from "./ui/MapControls"

// Type exports
export type { MapMarker, LatLng, Coordinate, IconConfig, MapOptions, Bounds, Point } from "./types"

// Core exports (selective to avoid conflicts)
export { useMapCore } from "./core/useMapCore"
export { MapProvider as MapContextProvider, useMapContext, useMap, useMapEvents } from "./core/MapContext"
export { EventBus } from "./core/EventBus"

// Provider exports (with renamed exports to avoid conflicts)
export type { MapProvider as IMapProvider } from "./providers/Provider.interface"
export { GoogleMapsProvider } from "./providers/GoogleMapsProvider"
export { LeafletMapProvider } from "./providers/leaflet/LeafletMapProvider"
export { ProviderFactory } from "./providers/ProviderFactory"

// Feature exports
export * from "./features"

// Feature Presets
export {
  FEATURE_PRESETS,
  getPresetConfig,
  mergeWithPreset,
  validateFeatureDependencies,
  getRecommendedPreset,
} from "./features/FeaturePresets"
export type { FeaturePreset } from "./features/FeaturePresets"

// Utilities
export {
  composeMapConfig,
  mergeFeatureConfigs,
  getEnabledFeatures,
  isFeatureEnabled,
  optimizeConfig,
  getConfigSummary,
} from "./utils/MapComposer"
export { extractPlaceBoundaries, calculateBounds, getCenterPoint } from "./utils/placeUtils"

// Hooks
export { useMapFeature, useMapFeatures } from "./hooks/useMapFeature"
export type { UseMapFeatureResult } from "./hooks/useMapFeature"
export { useMapControls } from "./hooks/useMapControls"
export { useGoogleMapsServices, useBoundaryPreview, useSearchLogic } from "./hooks"
export type { GoogleMapsServices, SearchPrediction } from "./hooks"
