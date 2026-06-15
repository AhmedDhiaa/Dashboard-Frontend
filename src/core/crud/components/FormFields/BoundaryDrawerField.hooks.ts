import { useCallback, useMemo, useState } from "react"
import type { Coordinate, LatLng, SearchResult } from "@/shared/types/maps"
import { logger } from "@/shared/logger"
import type { BoundaryPoint } from "./BoundaryDrawerField.types"

type SetValueFn = (name: string, value: unknown, options?: Record<string, boolean>) => void

/**
 * Hook for boundary mode handlers
 */
export function useBoundaryHandlers(name: string | undefined, setValue: SetValueFn) {
  const handleDrawingComplete = useCallback(
    (drawnBoundaries: unknown, _type: string) => {
      if (!Array.isArray(drawnBoundaries) || drawnBoundaries.length < 3) {
        logger.warn("[BoundaryDrawerField] Invalid polygon - need at least 3 points")
        return
      }

      logger.info(`[BoundaryDrawerField] Drawing shape completed with ${drawnBoundaries.length} points`)

      const boundaryPoints: BoundaryPoint[] = (drawnBoundaries as Coordinate[]).map(coord => ({
        longitude: coord.longitude,
        latitude: coord.latitude,
        angle: 0,
      }))

      setValue(name!, boundaryPoints, { shouldValidate: false, shouldDirty: true })
      logger.info(
        `[BoundaryDrawerField] Form updated with ${boundaryPoints.length} points, boundary feature should now display polygon`,
      )
      logger.debug(`[BoundaryDrawerField] First point: ${JSON.stringify(boundaryPoints[0])}`)
    },
    [name, setValue],
  )

  const handleBoundaryChange = useCallback(
    (updatedBoundaries: Coordinate[]) => {
      if (!updatedBoundaries) {
        logger.warn("[BoundaryDrawerField] Null/undefined boundaries received, ignoring update")
        return
      }

      if (updatedBoundaries.length === 0) {
        logger.info("[BoundaryDrawerField] Clearing boundaries")
        setValue(name!, [], { shouldValidate: false, shouldDirty: true })
        return
      }

      const boundaryPoints: BoundaryPoint[] = updatedBoundaries.map(coord => ({
        longitude: coord.longitude,
        latitude: coord.latitude,
        angle: 0,
      }))

      setValue(name!, boundaryPoints, { shouldValidate: false, shouldDirty: true })
      logger.debug(`[BoundaryDrawerField] Boundaries updated: ${boundaryPoints.length} points`)
    },
    [name, setValue],
  )

  const handleClearBoundaries = useCallback(() => {
    setValue(name!, [], { shouldValidate: false, shouldDirty: true })
  }, [name, setValue])

  const handleSearchResult = useCallback(
    (result: SearchResult | { boundaries?: Coordinate[] }) => {
      if ("boundaries" in result && result.boundaries && result.boundaries.length >= 3) {
        const boundaryPoints: BoundaryPoint[] = result.boundaries.map(coord => ({
          longitude: coord.longitude,
          latitude: coord.latitude,
          angle: 0,
        }))

        setValue(name!, boundaryPoints, { shouldValidate: false, shouldDirty: true })
      } else if ("boundaries" in result && Array.isArray(result.boundaries)) {
        const boundaryPoints: BoundaryPoint[] = result.boundaries.map(coord => ({
          longitude: coord.longitude,
          latitude: coord.latitude,
          angle: 0,
        }))

        setValue(name!, boundaryPoints, { shouldValidate: false, shouldDirty: true })
      }
    },
    [name, setValue],
  )

  return {
    handleDrawingComplete,
    handleBoundaryChange,
    handleClearBoundaries,
    handleSearchResult,
  }
}

/**
 * Hook for point mode handlers
 */
export function usePointHandlers(
  pointFields: { longitude: string; latitude: string; angle?: string } | undefined,
  setValue: SetValueFn,
) {
  const handleLocationPicked = useCallback(
    (location: LatLng) => {
      if (!pointFields) return

      setValue(pointFields.latitude, location.lat, { shouldValidate: true, shouldDirty: true })
      setValue(pointFields.longitude, location.lng, { shouldValidate: true, shouldDirty: true })
      logger.info(`[BoundaryDrawerField] Location picked: ${location.lat}, ${location.lng}`)
    },
    [pointFields, setValue],
  )

  const handleGetCurrentLocation = useCallback(() => {
    if (!pointFields || !navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude: lng } = position.coords
        setValue(pointFields.longitude, lng, { shouldValidate: true, shouldDirty: true })
        setValue(pointFields.latitude, latitude, { shouldValidate: true, shouldDirty: true })
        logger.info(`[BoundaryDrawerField] Current location: ${latitude}, ${lng}`)
      },
      error => {
        logger.error("[BoundaryDrawerField] Geolocation error:", error.message)
      },
    )
  }, [pointFields, setValue])

  const handleClearPoint = useCallback(() => {
    if (!pointFields) return

    setValue(pointFields.longitude, 0, { shouldValidate: false, shouldDirty: true })
    setValue(pointFields.latitude, 0, { shouldValidate: false, shouldDirty: true })
    if (pointFields.angle) {
      setValue(pointFields.angle, 0, { shouldValidate: false, shouldDirty: true })
    }
  }, [pointFields, setValue])

  return {
    handleLocationPicked,
    handleGetCurrentLocation,
    handleClearPoint,
  }
}

/**
 * Hook for combined location picker that works for both modes
 */
export function useCombinedLocationPicker(
  mode: "point" | "boundary",
  name: string | undefined,
  boundaries: BoundaryPoint[] | undefined,
  setValue: SetValueFn,
  pointLocationPickerHandler: (location: LatLng) => void,
) {
  return useCallback(
    (location: LatLng) => {
      if (mode === "point") {
        pointLocationPickerHandler(location)
      } else if (mode === "boundary" && name) {
        const currentBoundaries = (boundaries || []) as BoundaryPoint[]
        const newPoint: BoundaryPoint = {
          longitude: location.lng,
          latitude: location.lat,
          angle: 0,
        }
        const updatedBoundaries = [...currentBoundaries, newPoint]
        setValue(name, updatedBoundaries, { shouldValidate: false, shouldDirty: true })
      }
    },
    [mode, name, boundaries, setValue, pointLocationPickerHandler],
  )
}

/**
 * Hook for managing BoundaryDrawerField state
 */
export function useBoundaryFieldState(
  mode: "point" | "boundary",
  name: string | undefined,
  pointFields: { longitude: string; latitude: string; angle?: string } | undefined,
  watch: (name: string) => unknown,
) {
  const [isPointsListExpanded, setIsPointsListExpanded] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  // Open the drawing map by default so users can draw the boundary immediately
  // (boundary mode). Point mode keeps the map collapsed until requested.
  const [showMap, setShowMap] = useState(mode === "boundary")

  // Watch the current boundaries value (for boundary mode)
  const boundaries = mode === "boundary" && name ? (watch(name) as BoundaryPoint[] | undefined) : undefined

  // Watch point values (for point mode)
  const longitude = mode === "point" && pointFields ? (watch(pointFields.longitude) as number | undefined) : undefined
  const latitude = mode === "point" && pointFields ? (watch(pointFields.latitude) as number | undefined) : undefined

  // Convert boundaries to polygon data for display
  const polygonData = useMemo(
    () =>
      boundaries && boundaries.length > 0
        ? boundaries.map((b, idx) => ({
            longitude: b.longitude,
            latitude: b.latitude,
            sequence: idx,
          }))
        : undefined,
    [boundaries],
  )

  // Get point location for point mode
  const pointLocation: LatLng | null = useMemo(() => {
    if (mode === "point" && longitude && latitude && longitude !== 0 && latitude !== 0) {
      return { lat: latitude, lng: longitude }
    }
    return null
  }, [mode, longitude, latitude])

  // Coordinate copy handler
  const handleCopyCoordinate = useCallback(
    (point: BoundaryPoint, index: number) => {
      const text = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
      navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    },
    [setCopiedIndex],
  )

  return {
    isPointsListExpanded,
    setIsPointsListExpanded,
    copiedIndex,
    showMap,
    setShowMap,
    boundaries,
    polygonData,
    pointLocation,
    handleCopyCoordinate,
  }
}
