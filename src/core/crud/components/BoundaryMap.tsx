/**
 * Read-Only Boundary Map Component
 * Displays boundaries on a map without any editing controls
 */

"use client"

import dynamic from "next/dynamic"
import type { Coordinate } from "@/shared/types/maps"

// Dynamic import keeps the maps bundle out of the core/crud chunk and breaks
// the static core→features dependency. UnifiedMap is heavy (Google Maps SDK)
// so lazy-loading it on the client is the right move regardless.
const UnifiedMap = dynamic(() => import("@/features/maps/UnifiedMap").then(m => m.UnifiedMap), { ssr: false })

interface BoundaryMapProps {
  boundaries: Coordinate[]
  center?: { lat: number; lng: number }
  zoom?: number
  height?: string
}

export function BoundaryMap({ boundaries, center, zoom = 12, height = "400px" }: BoundaryMapProps) {
  // If no boundaries, don't render map
  if (!boundaries || boundaries.length === 0) {
    return null
  }

  // Calculate center from boundaries if not provided
  const mapCenter = center || calculateCenter(boundaries)

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm" style={{ height }}>
      <UnifiedMap
        center={mapCenter}
        zoom={zoom}
        className="w-full h-full"
        features={{
          boundaries: {
            enabled: true,
            initialBoundaries: boundaries,
            editable: false,
            fillColor: "#3b82f6",
            fillOpacity: 0.2,
            strokeColor: "#1e40af",
            strokeWeight: 2,
          },
        }}
      />
    </div>
  )
}

function calculateCenter(boundaries: Coordinate[]): { lat: number; lng: number } {
  if (boundaries.length === 0) {
    return { lat: 33.3152, lng: 44.3661 } // Default to Baghdad
  }

  const sum = boundaries.reduce(
    (acc, coord) => ({
      lat: acc.lat + coord.latitude,
      lng: acc.lng + coord.longitude,
    }),
    { lat: 0, lng: 0 },
  )

  return {
    lat: sum.lat / boundaries.length,
    lng: sum.lng / boundaries.length,
  }
}
