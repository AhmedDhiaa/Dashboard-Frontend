import type { FeatureConfig } from "../../Feature.interface"
import type { MapInstance, MapProvider, PolygonInstance, MarkerInstance } from "../../../providers/Provider.interface"
import type { Coordinate } from "../../../types"
import type { MarkerPool } from "../../../utils/markerPool"

export interface BoundaryFeatureConfig extends FeatureConfig {
  initialBoundaries?: Coordinate[]
  editable?: boolean
  onBoundariesChange?: (boundaries: Coordinate[]) => void
  fillColor?: string
  strokeColor?: string
  fillOpacity?: number
  strokeWeight?: number
  pointOptions?: {
    icon?: string | google.maps.Icon | google.maps.Symbol
    draggable?: boolean
    visible?: boolean
    shape?: "circle" | "square" | "diamond" | "pin"
  }
  /** Enable automatic polygon simplification for large polygons (default: true) */
  enableSimplification?: boolean
  /** Simplification tolerance (lower = more accurate, higher = more simplified) */
  simplificationTolerance?: number
  /** Enable marker pooling for vertex markers (default: true) */
  enableMarkerPooling?: boolean
}

export interface BoundaryFeatureState {
  hasBoundary: boolean
  pointCount: number
}

/**
 * Internal context exposed by BoundaryFeature to helper modules so they can
 * read/write the feature's private state without giving up encapsulation.
 */
export interface BoundaryCtx {
  readonly map: MapInstance | null
  readonly provider: MapProvider | null
  readonly config: BoundaryFeatureConfig | null
  readonly featureState: "uninitialized" | "initialized" | "enabled" | "disabled" | "destroyed"

  polygon: PolygonInstance | null
  vertexMarkers: MarkerInstance[]
  edgePolylines: google.maps.Polyline[]
  isUpdatingFromInternal: boolean
  isDestroying: boolean
  markerPool: MarkerPool | null
  pathChangeTimeout: ReturnType<typeof setTimeout> | null

  setData(data: BoundaryFeatureState): void
  notifyListeners(): void
  getBoundaries(): Coordinate[]
  clearBoundary(): void
}
