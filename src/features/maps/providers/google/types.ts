/**
 * Internal Google Maps provider types and type guards.
 */

/**
 * Google Maps event object type
 */
export interface GoogleMapsEvent {
  latLng?: google.maps.LatLng
  pixel?: google.maps.Point
  [key: string]: unknown
}

/**
 * Composite listener for polygon path changes
 */
export interface CompositePathListener {
  handler: (...args: unknown[]) => void
  setAtListener: google.maps.MapsEventListener
  insertAtListener: google.maps.MapsEventListener
  removeAtListener: google.maps.MapsEventListener
  googleListener: google.maps.MapsEventListener
}

/**
 * Type guard to check if listener is a composite path listener
 */
export function isCompositePathListener(listener: unknown): listener is CompositePathListener {
  return (
    typeof listener === "object" &&
    listener !== null &&
    "setAtListener" in listener &&
    "insertAtListener" in listener &&
    "removeAtListener" in listener
  )
}
