import type { Coordinate } from "../../types"

export type SearchType = "cities" | "places" | "addresses" | "geocode"
export type ControlPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"

export interface SearchResult {
  id: string
  name: string
  address: string
  location: { lat: number; lng: number }
  boundaries?: Coordinate[]
  type: string
  placeId?: string
}

export interface SearchControlConfig {
  /** Map instance (optional if used inside MapProvider) */
  map?: import("../../providers/Provider.interface").MapInstance | google.maps.Map | null

  /** Types of search to enable */
  types?: SearchType[]

  /** Placeholder text */
  placeholder?: string

  /** Control position */
  position?: ControlPosition

  /** Callback when a result is selected */
  onSelect?: (result: SearchResult) => void

  /** Whether to extract and return boundaries */
  extractBoundaries?: boolean

  /** Auto-focus on mount */
  autoFocus?: boolean

  /** Show boundary preview on map */
  showBoundaryPreview?: boolean

  /** Visibility toggle */
  visible?: boolean

  /** Close handler */
  onClose?: () => void

  /** Custom styling */
  className?: string
}

// Google Maps types
export interface GoogleMapsPrediction {
  place_id: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

export interface PlaceGeometryWithBounds extends google.maps.places.PlaceGeometry {
  bounds?: google.maps.LatLngBounds
}
