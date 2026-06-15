import { logger } from "@/shared/logger"
import type { PlaceGeometryWithBounds } from "./types"

export function extractPlaceBoundaries(
  place: google.maps.places.PlaceResult,
  shouldExtract: boolean,
): Array<{ latitude: number; longitude: number }> {
  if (!shouldExtract || !place.geometry?.location) return []

  let boundaries: Array<{ latitude: number; longitude: number }> = []
  const location = {
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng(),
  }

  const geometryWithBounds = place.geometry as PlaceGeometryWithBounds
  if (geometryWithBounds.bounds) {
    const bounds = geometryWithBounds.bounds
    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()

    boundaries = [
      { latitude: ne.lat(), longitude: ne.lng() },
      { latitude: ne.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: ne.lng() },
    ]
    logger.info(`[SearchControl] Using bounds for: ${place.name}`)
  } else if (place.geometry.viewport) {
    const viewport = place.geometry.viewport
    const ne = viewport.getNorthEast()
    const sw = viewport.getSouthWest()

    boundaries = [
      { latitude: ne.lat(), longitude: ne.lng() },
      { latitude: ne.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: ne.lng() },
    ]
    logger.info(`[SearchControl] Using viewport for: ${place.name}`)
  } else {
    const isLargeArea = place.types?.some((type: string) =>
      ["country", "administrative_area_level_1", "locality"].includes(type),
    )
    const offset = isLargeArea ? 0.005 : 0.002

    boundaries = [
      { latitude: location.lat + offset, longitude: location.lng + offset },
      { latitude: location.lat + offset, longitude: location.lng - offset },
      { latitude: location.lat - offset, longitude: location.lng - offset },
      { latitude: location.lat - offset, longitude: location.lng + offset },
    ]
    logger.info(`[SearchControl] Using default boundary for: ${place.name}`)
  }

  return boundaries
}

export function fitMapToBounds(
  map: import("../../providers/Provider.interface").MapInstance | google.maps.Map | null,
  bounds: google.maps.LatLngBoundsLiteral,
  location: { lat: number; lng: number },
) {
  try {
    if (map) {
      if ("fitBounds" in map && typeof map.fitBounds === "function") {
        map.fitBounds(bounds)
      } else if ("getNativeInstance" in map && map.getNativeInstance) {
        const nativeMap = map.getNativeInstance()
        nativeMap?.fitBounds(bounds)
      }
    }
  } catch (error) {
    logger.error("[SearchControl] Error fitting bounds:", error)
    if (map) {
      map.setCenter(location)
      map.setZoom(15)
    }
  }
}

export const POSITION_CLASSES: Record<
  "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right",
  string
> = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
}
