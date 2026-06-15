import type { Coordinate, LatLng } from "@/shared/types/maps"
import type { MapControlsConfig } from "./BoundaryDrawerField.types"

/**
 * Build map features based on mode
 */
export const buildMapFeatures = (
  mode: "point" | "boundary",
  pointLocation: LatLng | null | undefined,
  polygonData: Array<{ longitude: number; latitude: number; sequence: number }> | undefined,
  mapControls: MapControlsConfig,
  fillColor: string,
  strokeColor: string,
  onLocationPicked: ((location: LatLng) => void) | undefined,
  onDrawingComplete: (shape: unknown, type: string) => void,
  onBoundaryChange: (updatedBoundaries: Coordinate[]) => void,
) => {
  const enabled = !!polygonData && polygonData.length > 0

  return {
    // Point mode: Show location picker and draggable marker
    ...(mode === "point" && {
      markers: {
        enabled: true,
        markers: pointLocation
          ? [
              {
                id: "selected-location",
                position: pointLocation,
                title: "Selected Location",
                draggable: true,
                onDragEnd: (position: LatLng) => {
                  onLocationPicked?.(position)
                },
              },
            ]
          : [],
      },
    }),
    // Boundary mode: Show drawing controls and boundaries
    ...(mode === "boundary" && {
      drawing: mapControls.showDrawing
        ? {
            enabled: true,
            modes: ["polygon", "circle"] as ("polygon" | "circle")[],
            showControls: false,
            shouldClearAfterComplete: true,
            onShapeComplete: onDrawingComplete,
            polygonOptions: {
              fillColor,
              strokeColor,
              fillOpacity: 0.35,
              strokeWeight: 2,
            },
            circleOptions: {
              fillColor,
              strokeColor,
              fillOpacity: 0.35,
              strokeWeight: 2,
            },
          }
        : undefined,
      boundaries: {
        enabled,
        initialBoundaries: polygonData || [],
        fillColor,
        strokeColor,
        fillOpacity: 0.15,
        strokeWeight: 1.5,
        editable: true,
        fitBounds: enabled,
        onBoundariesChange: onBoundaryChange,
      },
    }),
  }
}

/**
 * Validate BoundaryDrawerField props
 */
export function validateBoundaryFieldProps(
  mode: "point" | "boundary",
  name: string | undefined,
  pointFields: { longitude: string; latitude: string; angle?: string } | undefined,
) {
  if (mode === "boundary" && !name) {
    throw new Error("BoundaryDrawerField: name is required for boundary mode")
  }
  if (mode === "point" && !pointFields) {
    throw new Error("BoundaryDrawerField: pointFields is required for point mode")
  }
}
