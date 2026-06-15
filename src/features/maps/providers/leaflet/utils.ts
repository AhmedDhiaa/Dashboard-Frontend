/**
 * Leaflet provider utilities.
 *
 * Pure helpers shared by the Leaflet provider + its instance wrappers:
 *   - icon conversion (our IconConfig → Leaflet Icon/DivIcon, asset-free)
 *   - event-name mapping (our MapEventType → Leaflet's event names)
 *   - free geocoding via OpenStreetMap Nominatim (no API key)
 *   - bounds conversion between our `Bounds` and Leaflet's `LatLngBounds`
 */

import type { DivIcon, Icon, LatLngBounds } from "leaflet"
import type { IconConfig, MapEventType, GeocodeResult } from "../Provider.interface"
import type { LatLng, Bounds } from "../../types"

/** The dynamically-imported Leaflet module namespace. */
export type LeafletModule = typeof import("leaflet")

/**
 * Our event names → Leaflet's. Mostly 1:1; the pointer enter/leave events
 * map onto Leaflet's `mouseover`/`mouseout`.
 */
export const LEAFLET_EVENT_MAP: Partial<Record<MapEventType, string>> = {
  load: "load",
  click: "click",
  dblclick: "dblclick",
  mousemove: "mousemove",
  mouseenter: "mouseover",
  mouseleave: "mouseout",
  dragstart: "dragstart",
  drag: "drag",
  dragend: "dragend",
  zoomstart: "zoomstart",
  zoom: "zoom",
  zoomend: "zoomend",
  movestart: "movestart",
  move: "move",
  moveend: "moveend",
  resize: "resize",
  error: "error",
}

/**
 * Build a Leaflet icon from our provider-agnostic icon config. When no image
 * URL is supplied we render an inline-SVG pin as a `DivIcon` — this sidesteps
 * Leaflet's well-known bundler issue where the default marker PNGs fail to
 * resolve, and keeps the marker themeable (token color via `text-primary`,
 * or an explicit `fillColor` when the caller themes it).
 */
export function toLeafletIcon(L: LeafletModule, icon?: string | IconConfig): Icon | DivIcon {
  if (typeof icon === "string") {
    return L.icon({ iconUrl: icon, iconSize: [28, 28], iconAnchor: [14, 28] })
  }
  if (icon?.url) {
    const w = icon.scaledSize?.width ?? 28
    const h = icon.scaledSize?.height ?? 28
    return L.icon({
      iconUrl: icon.url,
      iconSize: [w, h],
      iconAnchor: icon.anchor ? [icon.anchor.x, icon.anchor.y] : [w / 2, h],
    })
  }
  // A teardrop pin with a knockout hole (evenodd), drawn in `currentColor`
  // so the marker themes off the icon's text color — no hardcoded colors,
  // no external image assets.
  const colorStyle = icon?.fillColor ? ` style="color:${icon.fillColor}"` : ""
  const html =
    `<svg${colorStyle} width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" fill="currentColor">` +
    `<path fill-rule="evenodd" d="M13 0C5.8 0 0 5.8 0 13c0 9.2 13 21 13 21s13-11.8 13-21C26 5.8 20.2 0 13 0zm0 18a5 5 0 110-10 5 5 0 010 10z"/>` +
    `</svg>`
  return L.divIcon({ html, className: "text-primary", iconSize: [26, 34], iconAnchor: [13, 34] })
}

/** Our `Bounds` → Leaflet `LatLngBounds` (SW, NE corners). */
export function toLatLngBounds(L: LeafletModule, b: Bounds): LatLngBounds {
  return L.latLngBounds([b.south, b.west], [b.north, b.east])
}

/** Leaflet `LatLngBounds` → our `Bounds`. */
export function fromLatLngBounds(llb: LatLngBounds): Bounds {
  return { north: llb.getNorth(), south: llb.getSouth(), east: llb.getEast(), west: llb.getWest() }
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
  place_id: number
  type?: string
}

const NOMINATIM = "https://nominatim.openstreetmap.org"

function toGeocodeResults(rows: NominatimResult[]): GeocodeResult[] {
  return rows.map(r => ({
    address: r.display_name,
    location: { lat: Number.parseFloat(r.lat), lng: Number.parseFloat(r.lon) },
    placeId: String(r.place_id),
    types: r.type ? [r.type] : [],
  }))
}

/** Free forward geocoding via OpenStreetMap Nominatim (no key required). */
export async function geocodeNominatim(query: string): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM}/search?format=json&limit=5&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) return []
  return toGeocodeResults((await res.json()) as NominatimResult[])
}

/** Free reverse geocoding via OpenStreetMap Nominatim (no key required). */
export async function reverseGeocodeNominatim(latlng: LatLng): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM}/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) return []
  const row = (await res.json()) as NominatimResult & { error?: string }
  if (row.error || !row.lat) return []
  return toGeocodeResults([row])
}
