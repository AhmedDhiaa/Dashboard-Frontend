/**
 * Leaflet Map Provider — a FREE, key-less alternative to Google Maps.
 *
 * Renders OpenStreetMap raster tiles through Leaflet and geocodes via OSM
 * Nominatim — no API key, no billing, no signup. It implements the exact same
 * `MapProvider` contract as `GoogleMapsProvider`, so the rest of the app
 * (UnifiedMap, features, hooks) treats the two interchangeably; pick one with
 * the `provider` prop / `NEXT_PUBLIC_MAP_PROVIDER`.
 *
 * Leaflet itself is dynamically imported on `initialize()` (mirroring the
 * Google SDK's lazy load) so the library never enters a bundle until a map is
 * actually shown.
 */

import { logger } from "@/shared/logger"
import type { Map as LMap } from "leaflet"
import type {
  MapProvider,
  MapInstance,
  MarkerInstance,
  PolygonInstance,
  ClustererInstance,
  ClustererOptions,
  MarkerOptions,
  PolygonOptions,
  GeocodeResult,
} from "../Provider.interface"
import type { LatLng, Point, MapOptions } from "../../types"
import { LeafletMapInstance } from "./MapInstance"
import { LeafletMarkerInstance } from "./MarkerInstance"
import { LeafletPolygonInstance } from "./PolygonInstance"
import { LeafletClustererInstance } from "./ClustererInstance"
import {
  toLeafletIcon,
  geocodeNominatim,
  reverseGeocodeNominatim,
  type LeafletModule,
} from "./utils"

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export class LeafletMapProvider implements MapProvider {
  readonly name = "leaflet"
  readonly version = "1.0.0"

  private L: LeafletModule | null = null
  private initialized = false

  /** Lazy-load Leaflet. No API key needed — the param is ignored by design. */
  async initialize(): Promise<void> {
    if (this.initialized) return
    const mod: unknown = await import("leaflet")
    this.L = ((mod as { default?: LeafletModule }).default ?? mod) as LeafletModule
    this.initialized = true
    logger.info("[LeafletMapProvider] Initialized (OpenStreetMap, key-less)")
  }

  isLoaded(): boolean {
    return this.L !== null
  }

  isInitialized(): boolean {
    return this.initialized
  }

  private requireL(): LeafletModule {
    if (!this.L) throw new Error("Leaflet provider not initialized. Call initialize() first.")
    return this.L
  }

  createMap(container: HTMLElement, options: MapOptions): MapInstance {
    const L = this.requireL()
    // If this node still carries a previous Leaflet map (React StrictMode
    // double-mount / a re-init that didn't tear down first), `L.map()` throws
    // "Map container is already initialized". Reset the node so re-init is safe.
    const tagged = container as HTMLElement & { _leaflet_id?: number }
    if (tagged._leaflet_id != null) {
      tagged._leaflet_id = undefined
      container.innerHTML = ""
    }
    const map = L.map(container, {
      center: [options.center.lat, options.center.lng],
      zoom: options.zoom,
      maxZoom: options.maxZoom,
      minZoom: options.minZoom,
      zoomControl: options.zoomControl ?? true,
      // Leaflet's wheel zoom is the closest analogue to Google's "greedy".
      scrollWheelZoom: options.gestureHandling !== "none",
    })
    L.tileLayer(OSM_TILES, { maxZoom: options.maxZoom ?? 19, attribution: OSM_ATTRIBUTION }).addTo(map)
    return new LeafletMapInstance(map, L)
  }

  createMarker(options: MarkerOptions): MarkerInstance {
    const L = this.requireL()
    const marker = L.marker([options.position.lat, options.position.lng], {
      icon: toLeafletIcon(L, options.icon),
      draggable: options.draggable ?? false,
      title: options.title,
      zIndexOffset: options.zIndex,
      opacity: options.visible === false ? 0 : 1,
    })
    if (options.map) marker.addTo(options.map.getNativeInstance() as LMap)
    return new LeafletMarkerInstance(marker, L)
  }

  createPolygon(options: PolygonOptions): PolygonInstance {
    const L = this.requireL()
    const polygon = L.polygon(
      options.paths.map(p => [p.lat, p.lng]),
      {
        color: options.strokeColor,
        opacity: options.strokeOpacity,
        weight: options.strokeWeight,
        fillColor: options.fillColor,
        fillOpacity: options.fillOpacity,
      },
    )
    if (options.map) polygon.addTo(options.map.getNativeInstance() as LMap)
    return new LeafletPolygonInstance(polygon)
  }

  createClusterer(options: ClustererOptions): ClustererInstance {
    return new LeafletClustererInstance(options.map.getNativeInstance() as LMap)
  }

  latLngToPoint(latlng: LatLng, map: MapInstance): Point {
    const m = map.getNativeInstance() as LMap
    const p = m.project([latlng.lat, latlng.lng], m.getZoom())
    return { x: p.x, y: p.y }
  }

  pointToLatLng(point: Point, map: MapInstance): LatLng {
    const m = map.getNativeInstance() as LMap
    const ll = m.unproject([point.x, point.y], m.getZoom())
    return { lat: ll.lat, lng: ll.lng }
  }

  async geocode(address: string): Promise<GeocodeResult[]> {
    return geocodeNominatim(address)
  }

  async reverseGeocode(latlng: LatLng): Promise<GeocodeResult[]> {
    return reverseGeocodeNominatim(latlng)
  }

  destroy(): void {
    this.initialized = false
    this.L = null
  }
}
