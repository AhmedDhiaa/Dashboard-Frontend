/**
 * Provider Interface - Abstract Map Provider Contract
 *
 * Defines the contract that all map providers (Google Maps, Mapbox, Leaflet) must implement.
 * This abstraction allows the system to work with different mapping providers without
 * changing the core application logic.
 */

import type { LatLng, Bounds, Point, MapOptions } from "../types"

/**
 * Unique identifier for event listeners
 */
export type ListenerId = string | number

/**
 * Map instance interface - Provider-agnostic map abstraction
 */
export interface MapInstance {
  /** Get the native provider-specific map instance */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getNativeInstance(): any

  // View manipulation
  setCenter(latlng: LatLng): void
  setZoom(zoom: number): void
  fitBounds(
    bounds: Bounds,
    options?: { padding?: number | { top?: number; right?: number; bottom?: number; left?: number } },
  ): void
  panTo(latlng: LatLng): void
  panBy(x: number, y: number): void

  // View state
  getCenter(): LatLng
  getZoom(): number
  getBounds(): Bounds

  // Event handling
  on(event: MapEventType, handler: MapEventHandler): ListenerId
  off(id: ListenerId): void
  trigger(event: MapEventType, data?: unknown): void

  // Container
  getContainer(): HTMLElement
  resize(): void

  // State
  isReady(): boolean
  destroy(): void
}

/**
 * Map event types
 */
export type MapEventType =
  | "load"
  | "click"
  | "dblclick"
  | "mousemove"
  | "mouseenter"
  | "mouseleave"
  | "dragstart"
  | "drag"
  | "dragend"
  | "zoomstart"
  | "zoom"
  | "zoomend"
  | "movestart"
  | "move"
  | "moveend"
  | "resize"
  | "error"

/**
 * Map event handler function
 */
export type MapEventHandler = (event: MapEvent) => void

/**
 * Map event data
 */
export interface MapEvent {
  type: MapEventType
  latlng?: LatLng
  point?: Point
  originalEvent?: unknown
  target?: MapInstance
  [key: string]: unknown
}

/**
 * Marker instance interface
 */
export interface MarkerInstance {
  setPosition(latlng: LatLng): void
  getPosition(): LatLng
  setVisible(visible: boolean): void
  isVisible(): boolean
  setDraggable(draggable: boolean): void
  isDraggable(): boolean
  setIcon(icon: string | IconConfig): void
  setRotation(rotation: number): void
  remove(): void
  on(event: string, handler: (...args: unknown[]) => void): ListenerId
  off(id: ListenerId): void
  getNativeInstance(): unknown
}

/**
 * Polygon instance interface
 */
export interface PolygonInstance {
  setPath(path: LatLng[]): void
  getPath(): LatLng[]
  setEditable(editable: boolean): void
  isEditable(): boolean
  setVisible(visible: boolean): void
  isVisible(): boolean
  remove(): void
  setOptions(options: Partial<PolygonOptions>): void
  on(event: string, handler: (...args: unknown[]) => void): ListenerId
  off(id: ListenerId): void
  getBounds(): Bounds
  getNativeInstance(): unknown
}

/**
 * Main provider interface - All providers must implement this
 */
export interface MapProvider {
  /** Provider name */
  readonly name: string

  /** Provider version */
  readonly version: string

  // Lifecycle
  initialize(apiKey: string, options?: ProviderInitOptions): Promise<void>
  isLoaded(): boolean
  isInitialized(): boolean

  // Map creation
  createMap(container: HTMLElement, options: MapOptions): MapInstance

  // Marker operations
  createMarker(options: MarkerOptions): MarkerInstance

  // Polygon operations
  createPolygon(options: PolygonOptions): PolygonInstance

  // Utility operations
  latLngToPoint(latlng: LatLng, map: MapInstance): Point
  pointToLatLng(point: Point, map: MapInstance): LatLng
  geocode(address: string): Promise<GeocodeResult[]>
  reverseGeocode(latlng: LatLng): Promise<GeocodeResult[]>

  // Clusterer operations
  createClusterer(options: ClustererOptions): ClustererInstance

  // Cleanup
  destroy(): void
}

/**
 * Clusterer instance interface
 */
export interface ClustererInstance {
  addMarker(marker: MarkerInstance): void
  addMarkers(markers: MarkerInstance[]): void
  removeMarker(marker: MarkerInstance): void
  clearMarkers(): void
  render(): void
}

/**
 * Clusterer options
 */
export interface ClustererOptions {
  map: MapInstance
  markers?: MarkerInstance[]
  algorithm?: unknown
  renderer?: unknown
  onClusterClick?: (event: unknown) => void
}

/**
 * Provider initialization options
 */
export interface ProviderInitOptions {
  libraries?: string[]
  language?: string
  region?: string
  version?: string
  [key: string]: unknown
}

/**
 * Marker creation options
 */
export interface MarkerOptions {
  position: LatLng
  map?: MapInstance
  title?: string
  icon?: string | IconConfig
  draggable?: boolean
  visible?: boolean
  zIndex?: number
}

/**
 * Icon configuration
 */
export interface IconConfig {
  url?: string
  scaledSize?: { width: number; height: number }
  anchor?: { x: number; y: number }
  path?: string | number
  fillColor?: string
  fillOpacity?: number
  strokeColor?: string
  strokeWeight?: number
  scale?: number
  rotation?: number
}

/**
 * Polygon creation options
 */
export interface PolygonOptions {
  paths: LatLng[]
  map?: MapInstance
  strokeColor?: string
  strokeOpacity?: number
  strokeWeight?: number
  fillColor?: string
  fillOpacity?: number
  editable?: boolean
  draggable?: boolean
  visible?: boolean
}

/**
 * Geocoding result
 */
export interface GeocodeResult {
  address: string
  location: LatLng
  placeId?: string
  types?: string[]
}

/**
 * Provider factory result
 */
export interface ProviderFactory {
  createProvider(name: string, apiKey: string): Promise<MapProvider>
  getAvailableProviders(): string[]
}
