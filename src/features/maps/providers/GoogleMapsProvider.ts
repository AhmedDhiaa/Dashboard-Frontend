/**
 * Google Maps Provider - Implementation of MapProvider for Google Maps
 *
 * Adapts Google Maps JavaScript API to our provider-agnostic interface.
 */

import { setOptions, importLibrary } from "@googlemaps/js-api-loader"
import { MarkerClusterer } from "@googlemaps/markerclusterer"
import { logger } from "@/shared/logger"
import type {
  MapProvider,
  MapInstance,
  MarkerInstance,
  PolygonInstance,
  ClustererInstance,
  ClustererOptions,
  ProviderInitOptions,
  MarkerOptions,
  PolygonOptions,
  GeocodeResult,
} from "./Provider.interface"
import type { LatLng, Point, MapOptions } from "../types"
import { GoogleMapInstance } from "./google/MapInstance"
import { GoogleMarkerInstance } from "./google/MarkerInstance"
import { GooglePolygonInstance } from "./google/PolygonInstance"
import { GoogleClustererInstance } from "./google/ClustererInstance"
import { toGoogleIcon, geocodeAddress, reverseGeocodeLatLng } from "./google/utils"

/**
 * Google Maps Provider Implementation
 */
export class GoogleMapsProvider implements MapProvider {
  readonly name = "google"
  readonly version = "1.0.0"

  // No loader needed in v2
  private initialized = false
  private apiKey: string | null = null

  async initialize(apiKey: string, options?: ProviderInitOptions): Promise<void> {
    const librariesToLoad = options?.libraries || []

    if (this.initialized) {
      if (librariesToLoad.length > 0) {
        for (const lib of librariesToLoad) {
          try {
            await importLibrary(lib as Parameters<typeof importLibrary>[0])
          } catch (libError) {
            logger.error(`[GoogleMapsProvider] ❌ Failed to load library '${lib}':`, libError)
          }
        }
      } else {
        logger.debug("[GoogleMapsProvider] Already initialized and no libraries requested")
      }
      return
    }

    this.apiKey = apiKey
    // Validate API key
    if (!apiKey || apiKey.trim() === "" || apiKey === "YOUR_GOOGLE_MAPS_API_KEY") {
      const error = new Error(
        "Google Maps API key is missing or invalid. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.",
      )
      logger.error("[GoogleMapsProvider] ❌ Invalid API key")
      throw error
    }

    logger.info(
      `[GoogleMapsProvider] Initializing with key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`,
    )

    // Set options for the loader
    try {
      setOptions({
        key: apiKey,
        v: options?.version || "weekly",
        libraries: (options?.libraries as Parameters<typeof setOptions>[0]["libraries"]) || [],
        language: options?.language,
        region: options?.region,
      })
    } catch (error) {
      logger.error("[GoogleMapsProvider] ❌ Failed to set loader options", error)
      throw error
    }

    try {
      await importLibrary("core")
      await importLibrary("maps")
      await importLibrary("marker")

      // Import additional libraries if specified
      const librariesToLoad = options?.libraries || []
      if (librariesToLoad.length > 0) {
        for (const lib of librariesToLoad) {
          try {
            await importLibrary(lib as Parameters<typeof importLibrary>[0])
          } catch (libError) {
            logger.error(`[GoogleMapsProvider] ❌ Failed to load library '${lib}':`, libError)
            // Continue loading other libraries even if one fails
          }
        }
      }

      this.initialized = true
    } catch (error) {
      logger.error("[GoogleMapsProvider] ❌ Initialization failed:", error)
      throw error
    }
  }

  isLoaded(): boolean {
    return typeof window !== "undefined" && !!window.google?.maps
  }

  isInitialized(): boolean {
    return this.initialized
  }

  createMap(container: HTMLElement, options: MapOptions): MapInstance {
    if (!this.initialized) {
      throw new Error("Provider not initialized. Call initialize() first.")
    }

    // Clean, conventional control layout. Unneeded native controls are hidden;
    // the essentials are positioned so they don't overlap the app's own overlay
    // panels (the custom controls and search live at top-center).
    const map = new google.maps.Map(container, {
      center: options.center,
      zoom: options.zoom,
      maxZoom: options.maxZoom,
      minZoom: options.minZoom,
      // Single Map/Satellite toggle, kept out of the top-center overlay's way.
      mapTypeControl: options.mapTypeControl ?? true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DEFAULT,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      // Zoom buttons pinned to the bottom-right, clear of search/legend overlays.
      zoomControl: options.zoomControl ?? true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
      },
      gestureHandling: options.gestureHandling ?? "greedy",
      // Hidden controls we don't need for a clean interface.
      streetViewControl: false, // no pegman
      fullscreenControl: false, // app provides its own expand affordances
      rotateControl: false,
      scaleControl: false,
      // Dark mode styles
      styles: options.styles,
    })

    return new GoogleMapInstance(map)
  }

  createMarker(options: MarkerOptions): MarkerInstance {
    const icon = toGoogleIcon(options.icon)

    const marker = new google.maps.Marker({
      position: options.position,
      map: options.map?.getNativeInstance() as google.maps.Map,
      title: options.title,
      icon,
      draggable: options.draggable,
      visible: options.visible,
      zIndex: options.zIndex,
    })

    return new GoogleMarkerInstance(marker)
  }

  createPolygon(options: PolygonOptions): PolygonInstance {
    const polygon = new google.maps.Polygon({
      paths: options.paths,
      map: options.map?.getNativeInstance() as google.maps.Map,
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      editable: options.editable,
      draggable: options.draggable,
      visible: options.visible,
    })

    return new GooglePolygonInstance(polygon)
  }

  createClusterer(options: ClustererOptions): ClustererInstance {
    const clusterer = new MarkerClusterer({
      map: options.map.getNativeInstance() as google.maps.Map,
      markers: options.markers?.map(m => m.getNativeInstance() as google.maps.Marker) || [],
      algorithm: options.algorithm as unknown as import("@googlemaps/markerclusterer").Algorithm,
      renderer: options.renderer as unknown as import("@googlemaps/markerclusterer").Renderer,
      onClusterClick: options.onClusterClick,
    })

    return new GoogleClustererInstance(clusterer)
  }

  latLngToPoint(latlng: LatLng, map: MapInstance): Point {
    const googleMap = map.getNativeInstance() as google.maps.Map
    const projection = googleMap.getProjection()

    if (!projection) {
      throw new Error("Map projection not available")
    }

    const point = projection.fromLatLngToPoint(latlng)
    if (!point) {
      throw new Error("Failed to convert coordinates")
    }

    return { x: point.x, y: point.y }
  }

  pointToLatLng(point: Point, map: MapInstance): LatLng {
    const googleMap = map.getNativeInstance() as google.maps.Map
    const projection = googleMap.getProjection()

    if (!projection) {
      throw new Error("Map projection not available")
    }

    const latlng = projection.fromPointToLatLng(new google.maps.Point(point.x, point.y))
    if (!latlng) {
      throw new Error("Failed to convert point")
    }

    return { lat: latlng.lat(), lng: latlng.lng() }
  }

  async geocode(address: string): Promise<GeocodeResult[]> {
    if (!this.apiKey) {
      throw new Error("API key not available")
    }
    return geocodeAddress(address, this.apiKey)
  }

  async reverseGeocode(latlng: LatLng): Promise<GeocodeResult[]> {
    if (!this.apiKey) {
      throw new Error("API key not available")
    }
    return reverseGeocodeLatLng(latlng, this.apiKey)
  }

  destroy(): void {
    this.initialized = false
    this.apiKey = null
  }
}
