/**
 * Cross-layer map types. The canonical definitions live here so any layer
 * can use them without crossing into `features/`. The maps feature itself
 * re-exports from this module.
 */

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface LatLng {
  lat: number
  lng: number
}

export interface SearchResult {
  id: string
  name: string
  address: string
  location: LatLng
  boundaries?: Coordinate[]
  type: string
  placeId?: string
  geometry?: {
    location: LatLng
    // Google Maps types are optional consumers; keep loose to avoid forcing
    // every importer to load `@types/google.maps`.
    viewport?: { north: number; south: number; east: number; west: number }
    bounds?: { north: number; south: number; east: number; west: number }
  }
}
