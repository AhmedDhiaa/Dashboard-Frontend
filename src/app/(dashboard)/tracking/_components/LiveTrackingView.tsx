"use client"

/**
 * LiveTrackingView — the real-time fleet map.
 *
 * Data source is `useDriverTracking()` (infra/socket): in mock mode the
 * MockSignalRConnection emits synthetic `ReceiveDriverTracking` frames, in a
 * real deployment the same hook receives them from the SignalR hub — this
 * component is identical either way. Rendering uses `LeafletMapProvider`
 * (OpenStreetMap, no API key), so the demo works fully offline-of-a-backend.
 *
 * Browser-only (Leaflet touches `window`), so the route loads it via
 * `next/dynamic({ ssr: false })` — see TrackingClient.
 */

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import { Truck } from "lucide-react"
import { useT } from "@/shared/config"
import { useDriverTracking } from "@/infra/socket"
import { LeafletMapProvider } from "@/features/maps/providers/leaflet/LeafletMapProvider"
import type { MapInstance, MarkerInstance } from "@/features/maps/providers/Provider.interface"
import type { DriverTrackingDto } from "@/infra/socket/core/types"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import { cn } from "@/shared/utils"

const CITY_CENTER = { lat: 33.3152, lng: 44.3661 }

/** Pull the best {lat,lng} out of the several shapes a tracking DTO can take. */
function coordsOf(d: DriverTrackingDto): { lat: number; lng: number } | null {
  if (d.location) return d.location
  if (d.locationPoint) return { lat: d.locationPoint.latitude, lng: d.locationPoint.longitude }
  if (d.latitude != null && d.longitude != null) return { lat: d.latitude, lng: d.longitude }
  return null
}

const STATUS_DOT: Record<string, string> = {
  available: "bg-success",
  busy: "bg-warning",
  offline: "bg-muted-foreground",
}

export default function LiveTrackingView() {
  const t = useT("pages_tracking")
  // throttleMs: 0 — a fleet emits every driver's frame in one batch; the hook's
  // default single-slot throttle would coalesce the batch down to one driver.
  // We want every marker, and the simulator's ~1.5s cadence is already gentle.
  const { driverLocations, isConnected } = useDriverTracking({ throttleMs: 0 })

  const mapElRef = useRef<HTMLDivElement>(null)
  const providerRef = useRef<LeafletMapProvider | null>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const markersRef = useRef<Map<string, MarkerInstance>>(new Map())
  const [mapReady, setMapReady] = useState(false)

  // Initialise the Leaflet map once.
  useEffect(() => {
    if (!mapElRef.current) return
    const provider = new LeafletMapProvider()
    providerRef.current = provider
    let cancelled = false

    provider
      .initialize()
      .then(() => {
        if (cancelled || !mapElRef.current) return
        mapRef.current = provider.createMap(mapElRef.current, { center: CITY_CENTER, zoom: 12 })
        setMapReady(true)
      })
      .catch(() => {
        /* blocked/offline tiles — container degrades gracefully */
      })

    const markers = markersRef.current
    return () => {
      cancelled = true
      markers.forEach(m => m.remove())
      markers.clear()
      mapRef.current?.destroy()
      provider.destroy()
      providerRef.current = null
      mapRef.current = null
      setMapReady(false)
    }
  }, [])

  // Reconcile markers whenever positions change (or the map becomes ready).
  useEffect(() => {
    const provider = providerRef.current
    const map = mapRef.current
    if (!mapReady || !provider || !map) return

    const markers = markersRef.current
    driverLocations.forEach((driver, id) => {
      const pos = coordsOf(driver)
      if (!pos) return
      let marker = markers.get(id)
      if (!marker) {
        marker = provider.createMarker({ position: pos, map, title: driver.name ?? driver.code ?? id })
        markers.set(id, marker)
      } else {
        marker.setPosition(pos)
      }
      if (driver.heading != null) marker.setRotation(driver.heading)
    })
  }, [driverLocations, mapReady])

  // Centre the map on a driver when its list row is clicked.
  const focusDriver = (id: string) => {
    const driver = driverLocations.get(id)
    const pos = driver ? coordsOf(driver) : null
    const map = mapRef.current
    if (!pos || !map) return
    map.panTo(pos)
    map.setZoom(Math.max(map.getZoom(), 14))
  }

  const drivers = Array.from(driverLocations.values())

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* Map. `isolate` traps Leaflet's internal z-index stack (its panes/
          controls climb to z-1000) inside this card, so it can never paint over
          the app chrome — sidebar flyouts, header dropdowns and popovers render
          above the map as they should. */}
      <Card className="isolate overflow-hidden">
        <div className="relative">
          <div ref={mapElRef} className="h-[560px] w-full" role="application" aria-label={t("mapLabel")} />
          <div className="absolute top-3 start-3 z-[500] flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur">
            <span
              className={cn("size-2 rounded-full", isConnected ? "bg-success animate-pulse" : "bg-muted-foreground")}
            />
            {isConnected ? t("connected") : t("disconnected")}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{t("driversOnline", { count: drivers.length })}</span>
          </div>
        </div>
      </Card>

      <DriverPanel drivers={drivers} onSelect={focusDriver} />
    </div>
  )
}

type Translator = ReturnType<typeof useT>

function DriverPanel({ drivers, onSelect }: { drivers: DriverTrackingDto[]; onSelect: (id: string) => void }) {
  const t = useT("pages_tracking")
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-muted-foreground">
        {t("driversOnline", { count: drivers.length })}
      </h2>
      {drivers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Truck className="size-6 opacity-50" />
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        drivers.map(d => <DriverRow key={d.driverId} driver={d} t={t} onSelect={onSelect} />)
      )}
    </div>
  )
}

function DriverRow({ driver, t, onSelect }: { driver: DriverTrackingDto; t: Translator; onSelect: (id: string) => void }) {
  const status = driver.status ?? "offline"
  const label = driver.name ?? driver.code ?? driver.driverId
  return (
    <button
      type="button"
      onClick={() => onSelect(driver.driverId)}
      aria-label={t("focusDriver", { name: label })}
      className="w-full rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
        <CardContent className="flex items-center gap-3 py-3">
          <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_DOT[status] ?? "bg-muted-foreground")} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {driver.code} · {t(`status.${status}`)}
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {t("speed", { value: Math.round(driver.speed ?? 0) })}
          </span>
        </CardContent>
      </Card>
    </button>
  )
}
