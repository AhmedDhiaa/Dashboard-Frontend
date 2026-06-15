/**
 * Hook for managing map boundary previews
 * Used for temporary visualization before final selection
 */

import { useRef, useCallback } from "react"
import { logger } from "@/shared/logger"
import type { MapInstance } from "../providers/Provider.interface"
import type { Coordinate } from "../types"

interface BoundaryPreviewOptions {
  strokeColor?: string
  strokeOpacity?: number
  strokeWeight?: number
  fillColor?: string
  fillOpacity?: number
  editable?: boolean
  draggable?: boolean
}

const DEFAULT_OPTIONS: BoundaryPreviewOptions = {
  strokeColor: "#3b82f6",
  strokeOpacity: 0.8,
  strokeWeight: 3,
  fillColor: "#3b82f6",
  fillOpacity: 0.15,
  editable: true,
  draggable: false,
}

/**
 * Manages temporary boundary previews on the map
 * @param map - Map instance
 * @param enabled - Whether preview is enabled
 * @param options - Styling options
 */
export function useBoundaryPreview(
  map: MapInstance | null | undefined,
  enabled: boolean = true,
  options: BoundaryPreviewOptions = DEFAULT_OPTIONS,
) {
  const polygonRef = useRef<google.maps.Polygon | null>(null)

  const displayPreview = useCallback(
    (boundaries: Coordinate[]) => {
      if (!enabled || !map || boundaries.length === 0) return

      try {
        // Clear existing preview
        if (polygonRef.current) {
          polygonRef.current.setMap(null)
          polygonRef.current = null
        }

        // Get native map instance
        const nativeMap =
          "getNativeInstance" in map && typeof map.getNativeInstance === "function" ? map.getNativeInstance() : map

        if (!nativeMap || !(nativeMap instanceof window.google.maps.Map)) {
          logger.warn("[useBoundaryPreview] Invalid map instance")
          return
        }

        // Create polygon path
        const path = boundaries.map(b => ({
          lat: b.latitude,
          lng: b.longitude,
        }))

        // Create and display polygon
        const polygon = new window.google.maps.Polygon({
          paths: path,
          ...DEFAULT_OPTIONS,
          ...options,
          map: nativeMap,
        })

        polygonRef.current = polygon
        logger.info("[useBoundaryPreview] Preview displayed")
      } catch (error) {
        logger.error("[useBoundaryPreview] Display failed:", error)
      }
    },
    [enabled, map, options],
  )

  const clearPreview = useCallback(() => {
    if (polygonRef.current) {
      polygonRef.current.setMap(null)
      polygonRef.current = null
      logger.info("[useBoundaryPreview] Preview cleared")
    }
  }, [])

  return { displayPreview, clearPreview }
}
