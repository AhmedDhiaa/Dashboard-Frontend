import { useRef, useCallback, useEffect } from "react"
import { logger } from "@/shared/logger"

export function useBoundaryPreview(
  map: import("../../providers/Provider.interface").MapInstance | google.maps.Map | null,
  showBoundaryPreview: boolean,
) {
  const boundaryPolygonRef = useRef<google.maps.Polygon | null>(null)

  const displayBoundaryPreview = useCallback(
    (boundaries: Array<{ latitude: number; longitude: number }>) => {
      if (!showBoundaryPreview || !map || boundaries.length === 0) return

      try {
        if (boundaryPolygonRef.current) {
          boundaryPolygonRef.current.setMap(null)
          boundaryPolygonRef.current = null
        }

        const nativeMap =
          "getNativeInstance" in map && typeof map.getNativeInstance === "function" ? map.getNativeInstance() : map

        // Ensure nativeMap is a valid google.maps.Map instance
        if (!nativeMap || !(nativeMap instanceof window.google.maps.Map)) {
          logger.warn("[SearchControl] Invalid map instance for boundary preview")
          return
        }

        const path = boundaries.map(b => ({ lat: b.latitude, lng: b.longitude }))

        const polygon = new window.google.maps.Polygon({
          paths: path,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.8,
          strokeWeight: 3,
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          map: nativeMap,
          editable: true,
          draggable: false,
        })

        boundaryPolygonRef.current = polygon
        logger.info("[SearchControl] Boundary preview displayed")
      } catch (error) {
        logger.error("[SearchControl] Failed to display boundary preview:", error)
      }
    },
    [showBoundaryPreview, map],
  )

  const clearBoundaryPreview = useCallback(() => {
    if (boundaryPolygonRef.current) {
      boundaryPolygonRef.current.setMap(null)
      boundaryPolygonRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearBoundaryPreview()
    }
  }, [clearBoundaryPreview])

  return { displayBoundaryPreview, clearBoundaryPreview }
}
