"use client"

import { useEffect } from "react"
import type { LatLng } from "../types"
import type {
  MapEvent,
  MapInstance as ProviderMapInstance,
  MapProvider as MapProviderType,
} from "../providers/Provider.interface"

/**
 * Hook to handle map click events and location picking
 */
export function useMapClickHandling(
  map: ProviderMapInstance | null,
  mapProvider: MapProviderType | null,
  isReady: boolean,
  isPickingLocationRef: React.MutableRefObject<boolean>,
  setIsPickingLocation: React.Dispatch<React.SetStateAction<boolean>>,
  onMapClick?: (location: LatLng) => void,
  onLocationPicked?: (location: LatLng) => void,
) {
  useEffect(() => {
    if (!map || !mapProvider || !isReady) return
    if (!onMapClick && !onLocationPicked) return

    const clickListener = map.on("click", (event: MapEvent) => {
      const currentlyPicking = isPickingLocationRef.current

      // Extract coordinates - handle different event structures
      let location: { lat: number; lng: number } | null = null

      if ("lat" in event && "lng" in event) {
        location = { lat: event.lat as number, lng: event.lng as number }
      } else if ("latlng" in event && event.latlng) {
        // Google Maps format
        const latlng = event.latlng as { lat: number | (() => number); lng: number | (() => number) }
        if ("lat" in latlng && "lng" in latlng) {
          location = {
            lat: typeof latlng.lat === "function" ? latlng.lat() : latlng.lat,
            lng: typeof latlng.lng === "function" ? latlng.lng() : latlng.lng,
          }
        }
      }

      if (location) {
        // Priority: if picking location, use that handler; otherwise use onMapClick
        if (currentlyPicking && onLocationPicked) {
          onLocationPicked(location)
          setIsPickingLocation(false)
        } else if (onMapClick) {
          onMapClick(location)
        }
      }
    })

    return () => {
      if (clickListener) {
        map.off(clickListener)
      }
    }
  }, [map, mapProvider, isReady, onMapClick, onLocationPicked, isPickingLocationRef, setIsPickingLocation])
}
