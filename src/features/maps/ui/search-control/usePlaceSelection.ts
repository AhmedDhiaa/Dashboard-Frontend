import { useCallback } from "react"
import { logger } from "@/shared/logger"
import type { Coordinate } from "../../types"
import type { SearchResult } from "./types"
import { extractPlaceBoundaries, fitMapToBounds } from "./utils"

export function usePlaceSelection(
  placesService: React.MutableRefObject<google.maps.places.PlacesService | null>,
  extractBoundaries: boolean,
  displayBoundaryPreview: (boundaries: Array<{ latitude: number; longitude: number }>) => void,
  map: import("../../providers/Provider.interface").MapInstance | google.maps.Map | null,
  onSelect?: (result: SearchResult) => void,
) {
  const handlePlaceSelect = useCallback(
    (placeId: string): Promise<SearchResult | null> => {
      if (!placesService.current) return Promise.resolve(null)

      return new Promise(resolve => {
        try {
          placesService.current!.getDetails(
            {
              placeId,
              fields: ["name", "formatted_address", "geometry", "place_id", "address_components", "types"],
            },
            (place, status) => {
              if (
                status === window.google.maps.places.PlacesServiceStatus.OK &&
                place?.geometry?.location &&
                place.place_id &&
                place.name &&
                place.formatted_address
              ) {
                const location = {
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                }

                const boundaries = extractPlaceBoundaries(place, extractBoundaries)

                const formattedBoundaries: Coordinate[] = boundaries.map((b, index) => ({
                  ...b,
                  sequence: index,
                }))

                const result: SearchResult = {
                  id: place.place_id,
                  name: place.name,
                  address: place.formatted_address,
                  location,
                  boundaries: formattedBoundaries,
                  type: place.types?.[0] || "unknown",
                  placeId: place.place_id,
                }

                if (formattedBoundaries.length > 0) {
                  displayBoundaryPreview(formattedBoundaries)
                }

                if (formattedBoundaries.length > 0) {
                  const lats = formattedBoundaries.map(b => b.latitude)
                  const lngs = formattedBoundaries.map(b => b.longitude)
                  const bounds = {
                    north: Math.max(...lats),
                    south: Math.min(...lats),
                    east: Math.max(...lngs),
                    west: Math.min(...lngs),
                  }

                  fitMapToBounds(map, bounds, location)
                } else {
                  if (map) {
                    map.setCenter(location)
                    map.setZoom(15)
                  }
                }

                onSelect?.(result)
                logger.info(`[SearchControl] Place selected: ${place.name}`)

                resolve(result)
              } else {
                resolve(null)
              }
            },
          )
        } catch (error) {
          logger.error("[SearchControl] Failed to get place details:", error)
          resolve(null)
        }
      })
    },
    [extractBoundaries, displayBoundaryPreview, map, onSelect, placesService],
  )

  return { handlePlaceSelect }
}
