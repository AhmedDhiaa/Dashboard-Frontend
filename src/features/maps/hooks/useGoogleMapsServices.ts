/**
 * Reusable hook for Google Maps API services initialization
 * Supports autocomplete, places, and geocoding services
 */

import { useRef, useEffect } from "react"
import { logger } from "@/shared/logger"
import type { MapInstance } from "../providers/Provider.interface"

export interface GoogleMapsServices {
  autocompleteService: google.maps.places.AutocompleteService | null
  placesService: google.maps.places.PlacesService | null
  geocoder: google.maps.Geocoder | null
  isReady: boolean
}

const MAX_RETRIES = 10
const RETRY_DELAY = 200

/**
 * Initialize Google Maps services with retry logic
 * @param map - Map instance (native or wrapped)
 * @returns Object containing initialized services
 */
export function useGoogleMapsServices(map: MapInstance | null | undefined) {
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesService = useRef<google.maps.places.PlacesService | null>(null)
  const geocoder = useRef<google.maps.Geocoder | null>(null)
  const isReadyRef = useRef(false)

  useEffect(() => {
    let retryCount = 0
    let timeoutId: NodeJS.Timeout

    const initServices = (): boolean => {
      // Check window and Google Maps availability
      if (typeof window === "undefined" || !window.google?.maps) {
        return false
      }

      if (!map) {
        return false
      }

      // Check Places library availability
      if (!window.google.maps.places) {
        if (retryCount < MAX_RETRIES) {
          retryCount++
          timeoutId = setTimeout(initServices, RETRY_DELAY)
          return false
        }
        logger.error("[useGoogleMapsServices] Places library unavailable after retries")
        return false
      }

      try {
        // Get native map instance
        const nativeMap =
          "getNativeInstance" in map && typeof map.getNativeInstance === "function" ? map.getNativeInstance() : map

        if (!nativeMap || !(nativeMap instanceof window.google.maps.Map)) {
          logger.warn("[useGoogleMapsServices] Invalid map instance")
          return false
        }

        // Initialize services
        autocompleteService.current = new window.google.maps.places.AutocompleteService()
        placesService.current = new window.google.maps.places.PlacesService(nativeMap)
        geocoder.current = new window.google.maps.Geocoder()
        isReadyRef.current = true

        logger.info("[useGoogleMapsServices] ✅ Services initialized")
        return true
      } catch (error) {
        logger.error("[useGoogleMapsServices] Initialization failed:", error)
        return false
      }
    }

    initServices()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [map])

  return {
    autocompleteService: autocompleteService.current,
    placesService: placesService.current,
    geocoder: geocoder.current,
    isReady: isReadyRef.current,
  }
}
