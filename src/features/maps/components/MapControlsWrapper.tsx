"use client"

import { useCallback, useEffect, useState } from "react"
import { logger } from "@/shared/logger"
import { useMapContext } from "../core/MapContext"
import { featureRegistry } from "../features"
import { MapControls } from "../ui/MapControls"
import { SearchControl } from "../ui/SearchControl"
import { useMapControls } from "../hooks/useMapControls"
import { type BoundaryFeatureInstance, getDrawingFeatureInstance, handleBoundaryClear } from "../UnifiedMap.utils"
import type { LatLng } from "../types"
import type { MapFeatures } from "../UnifiedMap"

/**
 * Map Controls Wrapper (uses context)
 */
// eslint-disable-next-line max-lines-per-function -- Complex map controls integration
export function MapControlsWrapper({
  center,
  showDrawingControls,
  showSearchControl,
  showBoundaryPreview = true,
  features: _features,
  onSearchToggle,
  onSearchResult,
  onLocationPicked,
  onClear,
  isPickingLocation,
  setIsPickingLocation,
}: {
  center: LatLng
  showDrawingControls?: boolean
  showSearchControl?: boolean
  showBoundaryPreview?: boolean
  features: MapFeatures
  _position?: "top-right" | "top-left" | "bottom-right" | "bottom-left"
  _onToggleExpand?: () => void
  _isExpanded?: boolean
  onSearchToggle?: (visible: boolean) => void
  onSearchResult?: (result: import("../ui/SearchControl").SearchResult) => void
  onLocationPicked?: (location: LatLng) => void
  onClear?: () => void
  isPickingLocation: boolean
  setIsPickingLocation: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const { map, isReady } = useMapContext()
  const [isDrawing, setIsDrawing] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [hasBoundary, setHasBoundary] = useState(false)

  // Check for boundaries when features change
  useEffect(() => {
    const checkBoundaries = () => {
      let active = false

      const boundaryFeature = featureRegistry.getFeature("boundaries")
      if (boundaryFeature && typeof boundaryFeature.getData === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = boundaryFeature.getData() as any
        if (data?.hasBoundary) active = true
      }

      const drawingFeature = featureRegistry.getFeature("drawing")
      if (!active && drawingFeature && typeof drawingFeature.getData === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = drawingFeature.getData() as any
        if (data?.currentShape) active = true
      }

      setHasBoundary(active)
    }

    // Subscribe to both features for reactive updates
    const boundaryFeature = featureRegistry.getFeature("boundaries")
    const drawingFeature = featureRegistry.getFeature("drawing")

    let unsubBoundary: (() => void) | undefined
    let unsubDrawing: (() => void) | undefined

    if (boundaryFeature) {
      unsubBoundary = boundaryFeature.subscribe(() => checkBoundaries())
    }

    if (drawingFeature) {
      unsubDrawing = drawingFeature.subscribe(() => checkBoundaries())
    }

    // Fallback if subscriptions are not yet available or features not initialized
    checkBoundaries()

    return () => {
      unsubBoundary?.()
      unsubDrawing?.()
    }
  }, [isReady])

  const handleClearClick = useCallback(() => {
    // First clear the map features
    handleBoundaryClear()
    // Then call parent callback to clear form data
    onClear?.()
  }, [onClear])

  const handleToggleSearch = useCallback(() => {
    const newState = !showSearch
    setShowSearch(newState)
    onSearchToggle?.(newState)
  }, [showSearch, onSearchToggle])

  const handlePickLocation = useCallback(() => {
    const newState = !isPickingLocation
    setIsPickingLocation(newState)
  }, [isPickingLocation, setIsPickingLocation])

  const handleSearchSelect = useCallback(
    (result: import("../ui/SearchControl").SearchResult) => {
      logger.info(`[MapControlsWrapper] Search result selected: ${result.name}`)
      onSearchResult?.(result)
      setShowSearch(false)
      if (isDrawing) setIsDrawing(false)
    },
    [onSearchResult, isDrawing],
  )

  // Note: Map click handling is now unified in the effect above

  const controls = useMapControls({
    map,
    onDrawStart: useCallback(
      async (mode: "polygon" | "circle" = "polygon") => {
        const drawingFeature = getDrawingFeatureInstance(isReady, map)
        if (!drawingFeature) return

        try {
          setIsDrawing(true)
          const currentConfig = drawingFeature.getConfig?.() || drawingFeature.config || {}
          const originalOnComplete = (currentConfig as Record<string, unknown>)?.onShapeComplete as
            | ((shape: unknown, type: unknown) => void)
            | undefined

          drawingFeature.update({
            onShapeComplete: (shape: google.maps.Polygon | google.maps.Circle, type: unknown) => {
              setIsDrawing(false)
              originalOnComplete?.(shape, type)
            },
          })

          await drawingFeature.startDrawing(mode)
        } catch (err) {
          logger.error("[MapControlsWrapper] Failed to start drawing:", err)
          setIsDrawing(false)
        }
      },
      [isReady, map],
    ),
    onDrawStop: () => {
      setIsDrawing(false)
      const drawingFeature = getDrawingFeatureInstance(isReady, map)
      if (drawingFeature) {
        try {
          drawingFeature.stopDrawing()
          logger.info("[MapControlsWrapper] Successfully stopped drawing")
        } catch (error) {
          logger.error("[MapControlsWrapper] Error stopping drawing:", error)
        }
      }
    },
    onBoundaryClear: () => {
      handleBoundaryClear()
    },
  })

  // Keyboard shortcuts
  useEffect(() => {
    if (!showDrawingControls) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P to toggle drawing
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault()
        if (isDrawing) {
          controls.handleStopDrawing()
        } else {
          controls.handleStartDrawing()
        }
      }

      // ESC to cancel drawing
      if (e.key === "Escape" && isDrawing) {
        e.preventDefault()
        controls.handleStopDrawing()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showDrawingControls, isDrawing, controls])

  const handleFitBounds = useCallback(() => {
    const boundaryFeature = featureRegistry.getFeature("boundaries") as BoundaryFeatureInstance | null
    if (boundaryFeature?.polygon) {
      try {
        const nativePolygon = boundaryFeature.polygon as unknown as google.maps.Polygon
        const bounds = new google.maps.LatLngBounds()
        const path = nativePolygon.getPath()
        path.forEach((latLng: google.maps.LatLng) => {
          bounds.extend(latLng)
        })
        controls.handleFitBounds(bounds.toJSON())
      } catch (error) {
        logger.error("[MapControls] Failed to fit bounds:", error)
      }
    }
  }, [controls])

  return (
    <>
      <MapControls
        onToggleMapType={controls.handleToggleMapType}
        mapType={controls.mapType}
        onRecenter={() => controls.handleRecenter(center)}
        onFitBounds={handleFitBounds}
        onStartDrawing={mode => controls.handleStartDrawing(mode)}
        onStopDrawing={controls.handleStopDrawing}
        onClearBoundary={controls.handleClearBoundary}
        isDrawing={isDrawing}
        showDrawingControls={showDrawingControls}
        hasBoundary={hasBoundary}
        onToggleSearch={handleToggleSearch}
        showSearchControl={showSearchControl}
        onClear={handleClearClick}
        showSearch={showSearch}
        onPickLocation={onLocationPicked ? handlePickLocation : undefined}
        isPickingLocation={isPickingLocation}
      />

      {showSearch && (
        <SearchControl
          visible={showSearch}
          onClose={() => handleToggleSearch()}
          position="top-center"
          autoFocus={true}
          types={["cities", "places"]}
          onSelect={handleSearchSelect}
          extractBoundaries={true}
          showBoundaryPreview={showBoundaryPreview}
        />
      )}
    </>
  )
}
