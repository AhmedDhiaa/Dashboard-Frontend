/**
 * Utility functions for extracting place boundaries and locations
 */

import { logger } from "@/shared/logger"
import type { Coordinate } from "../types"

/**
 * Extract boundaries from place geometry
 * Supports viewport and bounds extraction
 */
export function extractPlaceBoundaries(place: google.maps.places.PlaceResult, shouldExtract: boolean): Coordinate[] {
  if (!shouldExtract || !place.geometry?.location) return []

  let boundaries: Coordinate[] = []
  const location = {
    latitude: place.geometry.location.lat(),
    longitude: place.geometry.location.lng(),
  }

  // Try viewport first (more accurate for cities/regions)
  if (place.geometry.viewport) {
    const ne = place.geometry.viewport.getNorthEast()
    const sw = place.geometry.viewport.getSouthWest()

    boundaries = [
      { latitude: ne.lat(), longitude: ne.lng() },
      { latitude: ne.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: ne.lng() },
    ]

    logger.info(`[extractPlaceBoundaries] Using viewport for: ${place.name}`)
  }
  // Fallback to bounds
  else if ("bounds" in place.geometry && place.geometry.bounds) {
    const bounds = place.geometry.bounds as google.maps.LatLngBounds
    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()

    boundaries = [
      { latitude: ne.lat(), longitude: ne.lng() },
      { latitude: ne.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: sw.lng() },
      { latitude: sw.lat(), longitude: ne.lng() },
    ]

    logger.info(`[extractPlaceBoundaries] Using bounds for: ${place.name}`)
  }
  // Last resort: single point
  else {
    boundaries = [location]
    logger.info(`[extractPlaceBoundaries] Using center point for: ${place.name}`)
  }

  return boundaries
}

/**
 * Calculate bounds from multiple coordinates
 */
export function calculateBounds(coordinates: Coordinate[]): google.maps.LatLngBoundsLiteral | null {
  if (coordinates.length === 0) return null

  const first = coordinates[0]
  if (!first) return null

  let minLat = first.latitude
  let maxLat = first.latitude
  let minLng = first.longitude
  let maxLng = first.longitude

  coordinates.forEach(coord => {
    minLat = Math.min(minLat, coord.latitude)
    maxLat = Math.max(maxLat, coord.latitude)
    minLng = Math.min(minLng, coord.longitude)
    maxLng = Math.max(maxLng, coord.longitude)
  })

  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng,
  }
}

/**
 * Get center point from coordinates
 */
export function getCenterPoint(coordinates: Coordinate[]): Coordinate | null {
  if (coordinates.length === 0) return null

  const sum = coordinates.reduce(
    (acc, coord) => ({
      latitude: acc.latitude + coord.latitude,
      longitude: acc.longitude + coord.longitude,
    }),
    { latitude: 0, longitude: 0 },
  )

  return {
    latitude: sum.latitude / coordinates.length,
    longitude: sum.longitude / coordinates.length,
  }
}
