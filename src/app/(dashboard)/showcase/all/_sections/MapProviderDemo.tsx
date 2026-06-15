"use client"

/**
 * MapProviderDemo — proves the platform map is provider-swappable.
 *
 * "Free · OpenStreetMap" renders a REAL interactive Leaflet map with NO API
 * key, driven through `LeafletMapProvider` — the same provider contract Google
 * implements. "Google Maps" explains how to switch on the key-based provider.
 * So a developer can pick "this or that" right here in the showcase.
 */

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { Map as MapIcon, KeyRound } from "lucide-react"
import { useT } from "@/shared/config"
import { Button } from "@/ui/design-system/primitives/button"
import { LeafletMapProvider } from "@/features/maps/providers/leaflet/LeafletMapProvider"
import type { MapInstance } from "@/features/maps/providers/Provider.interface"
import { MOCK_MAP_ROWS } from "../_shared/mock-data"

type ProviderKey = "leaflet" | "google"

/** A simple service-area boundary around Baghdad for the polygon demo. */
const BOUNDARY = [
  { lat: 33.45, lng: 44.25 },
  { lat: 33.45, lng: 44.52 },
  { lat: 33.21, lng: 44.52 },
  { lat: 33.21, lng: 44.25 },
]

/** Live OpenStreetMap map via LeafletMapProvider — markers + boundary, no key. */
function LeafletLiveMap() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const provider = new LeafletMapProvider()
    let map: MapInstance | null = null
    let cancelled = false

    provider
      .initialize()
      .then(() => {
        if (cancelled || !ref.current) return
        map = provider.createMap(ref.current, { center: { lat: 33.31, lng: 44.36 }, zoom: 10 })
        provider.createPolygon({ paths: BOUNDARY, map, strokeWeight: 2, fillOpacity: 0.08 })
        for (const row of MOCK_MAP_ROWS) {
          provider.createMarker({ position: row.position, map, title: row.label })
        }
      })
      .catch(() => {
        /* offline / blocked tiles — the empty container degrades gracefully */
      })

    return () => {
      cancelled = true
      map?.destroy()
      provider.destroy()
    }
  }, [])

  return <div ref={ref} className="h-[360px] w-full" role="application" aria-label="OpenStreetMap" />
}

export function MapProviderDemo() {
  const t = useT("showcase")
  const [active, setActive] = useState<ProviderKey>("leaflet")

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
        {(["leaflet", "google"] as const).map(key => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={active === key ? "primary" : "ghost"}
            onClick={() => setActive(key)}
            className="gap-1.5"
          >
            {key === "leaflet" ? <MapIcon className="size-3.5" /> : <KeyRound className="size-3.5" />}
            {t(key === "leaflet" ? "map.provider_free" : "map.provider_google")}
          </Button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {active === "leaflet" ? (
          <LeafletLiveMap />
        ) : (
          <div className="flex h-[360px] flex-col items-center justify-center gap-3 bg-muted/20 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="size-6" />
            </span>
            <p className="max-w-md text-sm text-muted-foreground">{t("map.google_needs_key")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
