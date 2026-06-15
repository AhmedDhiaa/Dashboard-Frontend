import type { Control, FieldValues } from "react-hook-form"
import type { Coordinate, LatLng, SearchResult } from "@/shared/types/maps"

export interface BoundaryPoint {
  longitude: number
  latitude: number
  angle?: number
}

export interface MapControlsConfig {
  /** Show drawing controls (polygon, circle) on map */
  showDrawing?: boolean
  /** Show search control on map */
  showSearch?: boolean
  /** Show add point control on map */
  showAddPoint?: boolean
  /** Custom position for controls (default: top-right) */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left"
}

export interface BoundaryDrawerFieldProps {
  /** Mode: 'point' for single location, 'boundary' for polygon boundaries */
  mode?: "point" | "boundary"
  /** Field name in the form (react-hook-form) - for boundary mode */
  name?: string
  /** Point fields for location mode */
  pointFields?: {
    longitude: string
    latitude: string
    angle?: string
  }
  /** Field label */
  label: string
  /** Field description/help text */
  description?: string
  /** Whether the field is required */
  required?: boolean
  /** Initial map center (default: Baghdad, Iraq) */
  center?: LatLng
  /** Initial zoom level (default: 10) */
  zoom?: number
  /** Map height (default: 500px) */
  mapHeight?: string
  /** Polygon fill color (default: blue) */
  fillColor?: string
  /** Polygon stroke color (default: dark blue) */
  strokeColor?: string
  /** Whether to show boundary points list (default: true) */
  showPointsList?: boolean
  /** Show manual coordinate inputs (for point mode) */
  showManualInputs?: boolean
  /** Show current location button */
  showCurrentLocation?: boolean
  /** Map controls configuration (what buttons to show on map) */
  mapControls?: MapControlsConfig
}

export interface BoundaryPointCardProps {
  point: BoundaryPoint
  index: number
  copiedIndex: number | null
  onCopy: (point: BoundaryPoint, index: number) => void
  t: (key: string) => string
}

export interface BoundaryInfoSectionProps {
  boundaries: BoundaryPoint[]
  showPointsList: boolean
  isExpanded: boolean
  onToggleExpanded: () => void
  onCopyCoordinate: (point: BoundaryPoint, index: number) => void
  copiedIndex: number | null
  t: (key: string) => string
}

export interface BoundaryFieldHeaderProps {
  label: string
  description?: string
  required?: boolean
  showMap: boolean
  onToggleMap: () => void
  t: (key: string) => string
}

export interface PointManualInputsProps {
  pointFields: { longitude: string; latitude: string; angle?: string }
  control: Control<FieldValues>
  showCurrentLocation?: boolean
  onGetCurrentLocation?: () => void
  t: (key: string) => string
}

export interface MapStatusDisplayProps {
  mode: "point" | "boundary"
  showMap: boolean
  boundaries?: BoundaryPoint[]
}

export interface BoundaryMapContainerProps {
  mode: "point" | "boundary"
  mapHeight: string
  center: google.maps.LatLngLiteral
  zoom: number
  mapControls: MapControlsConfig
  fillColor: string
  strokeColor: string
  polygonData: Array<{ longitude: number; latitude: number; sequence: number }> | undefined
  pointLocation?: LatLng | null
  onSearchResult: (result: SearchResult | { boundaries?: Coordinate[] }) => void
  onDrawingComplete: (shape: unknown, type: string) => void
  onBoundaryChange: (updatedBoundaries: Coordinate[]) => void
  onLocationPicked?: (location: LatLng) => void
  onClear: () => void
}

export interface BoundaryFieldContentProps {
  mode: "point" | "boundary"
  label: string
  description?: string
  required?: boolean
  showMap: boolean
  boundaries: BoundaryPoint[] | undefined
  pointLocation?: LatLng | null
  pointFields?: { longitude: string; latitude: string; angle?: string }
  showManualInputs?: boolean
  showCurrentLocation?: boolean
  showPointsList: boolean
  isPointsListExpanded: boolean
  copiedIndex: number | null
  mapHeight: string
  center: google.maps.LatLngLiteral
  zoom: number
  mapControls: MapControlsConfig
  fillColor: string
  strokeColor: string
  polygonData: Array<{ longitude: number; latitude: number; sequence: number }> | undefined
  control: Control<FieldValues>
  onToggleMap: () => void
  onClearBoundaries: () => void
  onGetCurrentLocation?: () => void
  onToggleExpanded: () => void
  onCopyCoordinate: (point: BoundaryPoint, index: number) => void
  onSearchResult: (result: SearchResult | { boundaries?: Coordinate[] }) => void
  onDrawingComplete: (shape: unknown, type: string) => void
  onBoundaryChange: (updatedBoundaries: Coordinate[]) => void
  onLocationPicked?: (location: LatLng) => void
  t: (key: string) => string
  fieldState: { error?: { message?: string } }
}
