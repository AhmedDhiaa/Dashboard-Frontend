/**
 * useMapControls Hook
 * Provides handlers for custom map controls
 */

"use client"

import { useState, useCallback } from "react"
import { logger } from "@/shared/logger"
import type { MapInstance } from "../providers/Provider.interface"

export interface UseMapControlsOptions {
  map: MapInstance | null
  initialMapType?: "roadmap" | "satellite" | "hybrid" | "terrain"
  onDrawStart?: (mode?: "polygon" | "circle") => void
  onDrawStop?: () => void
  onBoundaryClear?: () => void
  // Removed zoom controls - using map gestures instead
}

export function useMapControls({
  map,
  initialMapType = "roadmap",
  onDrawStart,
  onDrawStop,
  onBoundaryClear,
}: UseMapControlsOptions) {
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">(initialMapType)

  // Zoom In
  const handleZoomIn = useCallback(() => {
    if (!map) return
    try {
      const currentZoom = map.getZoom()
      map.setZoom(currentZoom + 1)
      logger.debug("[MapControls] Zoomed in")
    } catch (error) {
      logger.error("[MapControls] Zoom in failed:", error)
    }
  }, [map])

  // Zoom Out
  const handleZoomOut = useCallback(() => {
    if (!map) return
    try {
      const currentZoom = map.getZoom()
      map.setZoom(currentZoom - 1)
      logger.debug("[MapControls] Zoomed out")
    } catch (error) {
      logger.error("[MapControls] Zoom out failed:", error)
    }
  }, [map])

  // Toggle Map Type
  const handleToggleMapType = useCallback(() => {
    if (!map) return
    try {
      const types: Array<"roadmap" | "satellite" | "hybrid" | "terrain"> = ["roadmap", "satellite", "hybrid", "terrain"]
      const currentIndex = types.indexOf(mapType)
      const nextIndex = (currentIndex + 1) % types.length
      const nextType = types[nextIndex]

      if (!nextType) return // Type guard

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nativeMap = map.getNativeInstance() as any
      if (nativeMap && typeof nativeMap.setMapTypeId === "function") {
        nativeMap.setMapTypeId(nextType)
        setMapType(nextType)
        logger.info(`[MapControls] Map type changed to: ${nextType}`)
      }
    } catch (error) {
      logger.error("[MapControls] Map type toggle failed:", error)
    }
  }, [map, mapType])

  // Recenter Map
  const handleRecenter = useCallback(
    (center: { lat: number; lng: number }) => {
      if (!map) return
      try {
        map.setCenter(center)
        map.setZoom(13)
        logger.info("[MapControls] Map recentered")
      } catch (error) {
        logger.error("[MapControls] Recenter failed:", error)
      }
    },
    [map],
  )

  // Fit to Bounds
  const handleFitBounds = useCallback(
    (bounds: { north: number; south: number; east: number; west: number }) => {
      if (!map) return
      try {
        map.fitBounds(bounds)
        logger.info("[MapControls] Fitted to bounds")
      } catch (error) {
        logger.error("[MapControls] Fit bounds failed:", error)
      }
    },
    [map],
  )

  // Start Drawing
  const handleStartDrawing = useCallback(
    async (mode?: "polygon" | "circle") => {
      logger.info(`[MapControls] Drawing started with mode: ${mode || "polygon"}`)
      await onDrawStart?.(mode)
    },
    [onDrawStart],
  )

  // Stop Drawing
  const handleStopDrawing = useCallback(() => {
    logger.info("[MapControls] Drawing stopped")
    onDrawStop?.()
  }, [onDrawStop])

  // Clear Boundary
  const handleClearBoundary = useCallback(() => {
    logger.info("[MapControls] Boundary cleared")
    onBoundaryClear?.()
  }, [onBoundaryClear])

  return {
    mapType,
    handleZoomIn,
    handleZoomOut,
    handleToggleMapType,
    handleRecenter,
    handleFitBounds,
    handleStartDrawing,
    handleStopDrawing,
    handleClearBoundary,
  }
}
