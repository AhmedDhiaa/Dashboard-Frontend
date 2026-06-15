/**
 * Map Event Type Definitions
 * Separated to avoid circular dependencies between EventBus and types.ts
 */

import type { LatLng, MapMarker, MapPolygon, DrawingMode, SearchResult } from "../types"

/**
 * Shape types for drawing operations
 */
export type DrawnShape =
  | MapPolygon
  | MapMarker
  | {
      type: "circle"
      center: LatLng
      radius: number
    }
  | {
      type: "rectangle"
      bounds: { north: number; south: number; east: number; west: number }
    }
  | {
      type: "polyline"
      path: LatLng[]
    }

/**
 * Known event data types for type safety
 */
export interface EventDataMap {
  "map:ready": void
  "map:destroyed": void
  "map:click": { position: LatLng }
  "map:dblclick": { position: LatLng }
  "map:move": { center: LatLng; zoom: number }
  "map:zoom": { zoom: number }
  "feature:enabled": { featureName: string }
  "feature:disabled": { featureName: string }
  "feature:updated": { featureName: string; config: unknown }
  "marker:added": { marker: MapMarker }
  "marker:removed": { markerId: string }
  "marker:click": { marker: MapMarker; position: LatLng }
  "marker:drag": { marker: MapMarker; position: LatLng }
  "polygon:added": { polygon: MapPolygon }
  "polygon:removed": { polygonId: string }
  "polygon:click": { polygon: MapPolygon }
  "polygon:edit": { polygonId: string; paths: LatLng[] }
  "drawing:start": { mode: DrawingMode }
  "drawing:complete": { shape: DrawnShape; shapeType: DrawingMode }
  "drawing:cancel": void
  "search:query": { query: string }
  "search:result": { results: SearchResult[] }
  "search:select": { result: SearchResult }
  "tracking:update": { markers: MapMarker[] }
  "tracking:start": void
  "tracking:stop": void
}

/**
 * Event handler function with proper typing
 */
export type EventHandler<T = unknown> = (data: T) => void
