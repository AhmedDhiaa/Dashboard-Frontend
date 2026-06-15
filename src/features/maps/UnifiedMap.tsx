/**
 * Unified Map Component v2 - Feature-Based Architecture
 *
 * Complete rewrite using the new modular architecture.
 * Supports unlimited composable features through configuration.
 */

"use client"

import { useRef, useState, useEffect, memo, ReactNode, useCallback, useMemo } from "react"

import { cn } from "@/shared/utils"
import { logger } from "@/shared/logger"

import { useMapCore } from "./core/useMapCore"
import { MapProvider } from "./core/MapContext"
import { featureRegistry, createFeatureFactory } from "./features"
import { MarkerFeature } from "./features/markers/MarkerFeature"
import { BoundaryFeature } from "./features/polygons/BoundaryFeature"
import { DrawingFeature } from "./features/drawing/DrawingFeature"
import { PolylineFeature } from "./features/polylines/PolylineFeature"
import { AreasFeature } from "./features/polygons/AreasFeature"
import { getMapStyles } from "./utils/mapThemeStyles"
import { useLayout } from "@/ui/layout/LayoutContext"

import { MapLoadingOverlay } from "./components/MapLoadingOverlay"
import { MapControlsWrapper } from "./components/MapControlsWrapper"
import { useMapFeatures } from "./hooks/useMapFeatures"
import { useMapClickHandling } from "./hooks/useMapClickHandling"
import { useMapThemeUpdates } from "./hooks/useMapThemeUpdates"

import type { LatLng, MapOptions } from "./types"
import type { FeatureConfig } from "./features"

// Register all built-in features
featureRegistry.register(createFeatureFactory(MarkerFeature))
featureRegistry.register(createFeatureFactory(BoundaryFeature))
featureRegistry.register(createFeatureFactory(DrawingFeature))
featureRegistry.register(createFeatureFactory(PolylineFeature))
featureRegistry.register(createFeatureFactory(AreasFeature))

/**
 * Feature configuration map
 */
export interface MapFeatures {
  markers?: FeatureConfig & import("./features/markers/MarkerFeature").MarkerFeatureConfig
  boundaries?: FeatureConfig & import("./features/polygons/BoundaryFeature").BoundaryFeatureConfig
  drawing?: FeatureConfig & import("./features/drawing/DrawingFeature").DrawingFeatureConfig
  polylines?: FeatureConfig & import("./features/polylines/PolylineFeature").PolylineFeatureConfig
  areas?: FeatureConfig & import("./features/polygons/AreasFeature").AreasFeatureConfig
  [key: string]: FeatureConfig | undefined
}

/**
 * Unified Map Props
 */
export interface UnifiedMapProps {
  // Core map configuration
  center: LatLng
  zoom?: number
  maxZoom?: number
  minZoom?: number
  height?: string
  width?: string
  className?: string

  // Provider
  provider?: string
  apiKey?: string
  libraries?: string[]

  // Map controls (Google Maps default controls) - Simplified
  zoomControl?: boolean
  mapTypeControl?: boolean
  gestureHandling?: "cooperative" | "greedy" | "none" | "auto"

  // Custom controls
  showCustomControls?: boolean
  showDrawingControls?: boolean
  showSearchControl?: boolean
  /** Enable boundary preview when searching */
  showBoundaryPreview?: boolean
  controls_position?: "top-right" | "top-left" | "bottom-right" | "bottom-left"

  // Layout interactions
  _onToggleExpand?: () => void
  _isExpanded?: boolean

  // Search state callback
  onSearchToggle?: (visible: boolean) => void
  onSearchResult?: (result: import("./ui/SearchControl").SearchResult) => void

  // Map interaction callbacks
  onMapClick?: (location: LatLng) => void
  onLocationPicked?: (location: LatLng) => void
  onClear?: () => void

  // Features
  features?: MapFeatures

  // Lifecycle callbacks
  onMapReady?: () => void
  onMapError?: (error: Error) => void

  // Children (for custom UI overlays)
  children?: ReactNode
}

/**
 * Unified Map Component - Feature-Based
 */
const UnifiedMapComponent = function UnifiedMap({
  center,
  zoom = 13,
  maxZoom,
  minZoom,
  height = "600px",
  width = "100%",
  className,
  provider = process.env.NEXT_PUBLIC_MAP_PROVIDER || "google",
  apiKey,
  libraries = [],
  zoomControl = true,
  mapTypeControl = true,
  gestureHandling = "greedy",
  showCustomControls = true,
  showDrawingControls = false,
  showSearchControl = false,
  showBoundaryPreview = true,
  features = {},
  onSearchToggle,
  onSearchResult,
  onMapClick,
  onLocationPicked,
  onClear,
  onMapReady,
  onMapError,
  children,
}: UnifiedMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const { theme } = useLayout()
  const [isDarkMode, setIsDarkMode] = useState(theme === "dark")
  const [isPickingLocation, setIsPickingLocation] = useState(false)

  useEffect(() => {
    setIsDarkMode(theme === "dark")
  }, [theme])

  useEffect(() => {
    if (containerRef.current) {
      setContainerElement(containerRef.current)
    }
  }, [])

  const hasDrawingFeature = !!features.drawing
  const requiredLibraries = useMemo(() => {
    const libs = [...libraries]
    if (hasDrawingFeature && !libs.includes("drawing")) {
      libs.push("drawing")
    }
    if (!libs.includes("places")) {
      libs.push("places")
    }
    return libs
  }, [libraries, hasDrawingFeature])

  const mapOptions: MapOptions = useMemo(
    () => ({
      center,
      zoom,
      maxZoom,
      minZoom,
      zoomControl,
      mapTypeControl,
      gestureHandling,
      styles: getMapStyles(isDarkMode),
    }),
    [center, zoom, maxZoom, minZoom, zoomControl, mapTypeControl, gestureHandling, isDarkMode],
  )

  const resolvedApiKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""

  const {
    map,
    provider: mapProvider,
    isLoading,
    isReady,
    error,
    retry,
  } = useMapCore({
    container: containerElement,
    provider,
    apiKey: resolvedApiKey,
    mapOptions,
    libraries: requiredLibraries,
  })

  // Wire up map click handler (unified for both onMapClick and location picking)
  // Using useRef to avoid closure issues with isPickingLocation
  const isPickingLocationRef = useRef(isPickingLocation)
  useEffect(() => {
    isPickingLocationRef.current = isPickingLocation
  }, [isPickingLocation])

  // Handle location picking and click events
  useMapClickHandling(
    map,
    mapProvider,
    isReady,
    isPickingLocationRef,
    setIsPickingLocation,
    onMapClick,
    onLocationPicked,
  )

  // Handle dark mode theme updates
  useMapThemeUpdates(map, isReady, isDarkMode)

  // Handle center and zoom updates
  useEffect(() => {
    if (!isReady || !map) return

    logger.debug("[UnifiedMap] Updating center/zoom", { center, zoom })

    // Check if center is different from current to avoid unnecessary pans
    const currentCenter = map.getCenter()
    const distance = Math.sqrt(
      Math.pow(currentCenter.lat - center.lat, 2) + Math.pow(currentCenter.lng - center.lng, 2),
    )

    if (distance > 0.00001) {
      map.panTo(center)
    }

    if (map.getZoom() !== zoom) {
      map.setZoom(zoom)
    }
  }, [center, zoom, isReady, map])

  const { featuresInitialized } = useMapFeatures(map, mapProvider, isReady, features, onMapReady, onMapError)

  // Memoize error retry handler
  const handleRetry = useCallback(() => {
    retry()
  }, [retry])

  return (
    <MapProvider map={map} provider={mapProvider}>
      <div className={cn("relative", className)} style={{ height, width }}>
        {/* Always render the container div so ref can attach */}
        <div ref={containerRef} className="w-full h-full rounded-lg" />

        {/* Custom Controls (only when map is ready and features are initialized) */}
        {isReady && featuresInitialized && showCustomControls && (
          <MapControlsWrapper
            center={center}
            showDrawingControls={showDrawingControls}
            showSearchControl={showSearchControl}
            showBoundaryPreview={showBoundaryPreview}
            features={features}
            onSearchToggle={onSearchToggle}
            onSearchResult={onSearchResult}
            onLocationPicked={onLocationPicked}
            onClear={onClear}
            isPickingLocation={isPickingLocation}
            setIsPickingLocation={setIsPickingLocation}
          />
        )}

        {/* Overlay loading/error states on top */}
        <MapLoadingOverlay isLoading={isLoading} isReady={isReady} error={error} onRetry={handleRetry} />

        {children}
      </div>
    </MapProvider>
  )
}

// Memoize with optimized comparison to prevent unnecessary re-renders
export const UnifiedMap = memo(UnifiedMapComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  const centerChanged = prevProps.center.lat !== nextProps.center.lat || prevProps.center.lng !== nextProps.center.lng

  const basicPropsChanged =
    prevProps.zoom !== nextProps.zoom ||
    prevProps.height !== nextProps.height ||
    prevProps.width !== nextProps.width ||
    prevProps.showCustomControls !== nextProps.showCustomControls ||
    prevProps.showDrawingControls !== nextProps.showDrawingControls ||
    prevProps._isExpanded !== nextProps._isExpanded

  // Check if features object reference changed (simpler than deep comparison)
  const featuresChanged = prevProps.features !== nextProps.features

  return !centerChanged && !basicPropsChanged && !featuresChanged
})

UnifiedMap.displayName = "UnifiedMap"
