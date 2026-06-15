"use client"

import { MapPin } from "lucide-react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { UnifiedMap } from "@/features/maps/UnifiedMap"
import { useT } from "@/shared/config"
import type { FieldValue } from "@/types/field-types"

/**
 * Map Location Renderer Component
 * Displays coordinates on an interactive map with a marker.
 */
export function MapLocationRenderer({
  value,
  config,
}: {
  value: FieldValue
  config?: {
    mapZoom?: number
    mapHeight?: string
    className?: string
  }
}) {
  const t = useT()
  const location = value as { latitude: number; longitude: number } | null | undefined

  if (!location || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2 px-3 bg-muted/20 rounded-lg border border-dashed border-border">
        <MapPin className="h-4 w-4" />
        <span className="italic">{t("map.location.not_available")}</span>
      </div>
    )
  }

  const center = { lat: location.latitude, lng: location.longitude }

  return (
    <div className={`rounded-xl overflow-hidden border border-border bg-card shadow-sm ${config?.className || ""}`}>
      <UnifiedMap
        center={center}
        zoom={config?.mapZoom || 14}
        minZoom={5}
        maxZoom={20}
        height={config?.mapHeight || "300px"}
        features={{
          markers: {
            enabled: true,
            markers: [
              {
                id: "location-point",
                position: center,
                title: t("pages.location_point"),
              },
            ],
          },
        }}
      />
      <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between text-xs">
        <div className="flex gap-4">
          <span>
            {t("pages.latitude")}:{" "}
            <span className="font-mono font-bold text-primary">{location.latitude.toFixed(6)}</span>
          </span>
          <span>
            {t("pages.longitude")}:{" "}
            <span className="font-mono font-bold text-primary">{location.longitude.toFixed(6)}</span>
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight py-0">
          {t("map.location.verified")}
        </Badge>
      </div>
    </div>
  )
}
