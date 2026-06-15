/**
 * Map System - Core Type Definitions
 * Centralized types for the entire map subsystem
 */

// ============================================================================
// COORDINATE TYPES
// ============================================================================

export interface Coordinate {
  latitude: number
  longitude: number
  sequence?: number
}

export interface LatLng {
  lat: number
  lng: number
}

export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

export interface Point {
  x: number
  y: number
}

// ============================================================================
// MAP CONFIGURATION
// ============================================================================

export interface MapOptions {
  center: LatLng
  zoom: number
  maxZoom?: number
  minZoom?: number
  mapTypeControl?: boolean
  zoomControl?: boolean
  gestureHandling?: "cooperative" | "greedy" | "none" | "auto"
  styles?: google.maps.MapTypeStyle[]
}

// ============================================================================
// MARKER TYPES
// ============================================================================

export interface MapMarker {
  id: string
  position: LatLng
  title?: string
  description?: string
  icon?: string | IconConfig
  color?: string
  draggable?: boolean
  visible?: boolean
  onClick?: () => void
  onDragEnd?: (position: LatLng) => void
  metadata?: Record<string, unknown>
}

export interface IconConfig {
  url?: string
  scaledSize?: { width: number; height: number }
  anchor?: { x: number; y: number }
  path?: string
  fillColor?: string
  fillOpacity?: number
  strokeColor?: string
  strokeWeight?: number
  scale?: number
  rotation?: number
}

// ============================================================================
// POLYGON TYPES
// ============================================================================

export interface MapPolygon {
  id: string
  paths: LatLng[]
  strokeColor?: string
  strokeOpacity?: number
  strokeWeight?: number
  fillColor?: string
  fillOpacity?: number
  editable?: boolean
  draggable?: boolean
  visible?: boolean
  onClick?: () => void
}

// ============================================================================
// DRAWING TYPES
// ============================================================================

export type DrawingMode = "marker" | "polygon" | "polyline" | "circle" | "rectangle"

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SearchResult {
  id: string
  name: string
  address: string
  location: LatLng
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
