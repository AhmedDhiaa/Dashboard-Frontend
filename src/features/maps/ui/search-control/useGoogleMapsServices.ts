import { useRef, useEffect } from "react"
import { logger } from "@/shared/logger"

export function useGoogleMapsServices(
  map: import("../../providers/Provider.interface").MapInstance | google.maps.Map | null,
) {
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesService = useRef<google.maps.places.PlacesService | null>(null)
  const geocoder = useRef<google.maps.Geocoder | null>(null)

  useEffect(() => {
    let retryCount = 0
    const maxRetries = 10

    const initServices = () => {
      if (typeof window === "undefined" || !window.google || !window.google.maps) {
        return false
      }

      if (!map) {
        return false
      }

      if (!window.google.maps.places) {
        if (retryCount < maxRetries) {
          retryCount++
          setTimeout(initServices, 200)
          return false
        }
        logger.error("[SearchControl] Google Maps Places library not available after retries")
        return false
      }

      try {
        const nativeMap =
          "getNativeInstance" in map && typeof map.getNativeInstance === "function" ? map.getNativeInstance() : map
        if (!nativeMap) {
          logger.warn("[SearchControl] Native map instance not available")
          return false
        }

        // Type guard to ensure nativeMap is a google.maps.Map instance
        if (!(nativeMap instanceof window.google.maps.Map)) {
          logger.warn("[SearchControl] nativeMap is not a google.maps.Map instance")
          return false
        }

        autocompleteService.current = new window.google.maps.places.AutocompleteService()
        placesService.current = new window.google.maps.places.PlacesService(nativeMap)
        geocoder.current = new window.google.maps.Geocoder()

        logger.info("[SearchControl] ✅ Services initialized successfully")
        return true
      } catch (error) {
        logger.error("[SearchControl] ❌ Failed to initialize services:", error)
        return false
      }
    }

    initServices()
  }, [map])

  return { autocompleteService, placesService, geocoder }
}
