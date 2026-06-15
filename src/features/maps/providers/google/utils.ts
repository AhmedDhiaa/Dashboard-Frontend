/**
 * Pure helpers for the Google Maps provider.
 */

import { logger } from "@/shared/logger"
import type { GeocodeResult, IconConfig } from "../Provider.interface"
import type { LatLng } from "../../types"

/**
 * Convert an IconConfig (or string URL) to a Google Maps icon/symbol/string.
 */
export function toGoogleIcon(
  icon: string | IconConfig | undefined,
): string | google.maps.Icon | google.maps.Symbol | undefined {
  if (typeof icon === "string") {
    return icon
  }

  if (!icon) return undefined

  if (icon.path !== undefined) {
    return {
      path: icon.path,
      fillColor: icon.fillColor,
      fillOpacity: icon.fillOpacity ?? 1,
      strokeColor: icon.strokeColor,
      strokeWeight: icon.strokeWeight,
      scale: icon.scale,
      rotation: icon.rotation,
      anchor: icon.anchor ? new google.maps.Point(icon.anchor.x, icon.anchor.y) : undefined,
    } as google.maps.Symbol
  }

  return {
    url: icon.url || "",
    scaledSize: icon.scaledSize ? new google.maps.Size(icon.scaledSize.width, icon.scaledSize.height) : undefined,
    anchor: icon.anchor ? new google.maps.Point(icon.anchor.x, icon.anchor.y) : undefined,
  } as google.maps.Icon
}

interface GeocodeApiResponse {
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
  place_id: string
  types: string[]
}

/**
 * Call the Google Geocoding REST API and map results.
 */
export async function fetchGeocode(url: string, errorTag: string): Promise<GeocodeResult[]> {
  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === "OK" && data.results.length > 0) {
      return data.results.map((result: GeocodeApiResponse) => ({
        address: result.formatted_address,
        location: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        },
        placeId: result.place_id,
        types: result.types,
      }))
    }

    return []
  } catch (error) {
    logger.error(errorTag, error)
    return []
  }
}

/**
 * Geocode an address using the Google Geocoding API.
 */
export function geocodeAddress(address: string, apiKey: string): Promise<GeocodeResult[]> {
  return fetchGeocode(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`,
    "[GoogleMapsProvider] Geocoding failed",
  )
}

/**
 * Reverse geocode a LatLng using the Google Geocoding API.
 */
export function reverseGeocodeLatLng(latlng: LatLng, apiKey: string): Promise<GeocodeResult[]> {
  return fetchGeocode(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng.lat},${latlng.lng}&key=${apiKey}`,
    "[GoogleMapsProvider] Reverse geocoding failed",
  )
}
