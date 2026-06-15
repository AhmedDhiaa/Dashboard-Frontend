"use client"
// Calls useT()/useLocale() — required to be a Client Component.
// Enforced by scripts/check-rsc-boundaries.mjs.

/**
 * Vehicle Park Custom Field Renderers
 */

import { useT } from "@/shared/config"
import { BoundaryDrawerField } from "@/core/crud/components/FormFields/BoundaryDrawerField"

/**
 * Location Point Field Renderer
 * Single point for vehicle park entrance/center
 */
export const ExampleLocationField = () => {
  const t = useT()

  return (
    <div className="space-y-4">
      <BoundaryDrawerField
        mode="point"
        label={t("pages.location_point")}
        description={t("pages.location_point_description")}
        required
        pointFields={{
          longitude: "locationPoint.longitude",
          latitude: "locationPoint.latitude",
        }}
        center={{ lat: 33.3152, lng: 44.3661 }}
        zoom={11}
        showCurrentLocation={true}
        showManualInputs={true}
        mapControls={{
          showDrawing: false,
          showSearch: false,
          showAddPoint: true,
        }}
        mapHeight="400px"
      />
    </div>
  )
}

/**
 * Boundaries Field Renderer
 * Polygon boundaries for the vehicle park area
 */
export const ExampleBoundariesField = () => {
  const t = useT()

  return (
    <div className="space-y-4">
      <BoundaryDrawerField
        mode="boundary"
        name="boundaries"
        label={t("pages.example.boundaries")}
        description={t("pages.example.boundaries_description")}
        required
        center={{ lat: 33.3152, lng: 44.3661 }}
        zoom={11}
        showPointsList={true}
        mapControls={{
          showDrawing: true,
          showSearch: true,
          showAddPoint: true,
        }}
        mapHeight="500px"
        fillColor="#10b981"
        strokeColor="#059669"
      />
    </div>
  )
}
