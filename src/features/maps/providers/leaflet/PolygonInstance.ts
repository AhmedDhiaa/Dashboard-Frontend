/**
 * LeafletPolygonInstance — wraps a native Leaflet `Polygon`.
 *
 * `setEditable` is a best-effort no-op: in-place vertex editing needs the
 * Leaflet.Editable / Geoman plugin, which the free provider doesn't bundle.
 * The polygon still renders, restyles, and reports its bounds.
 */

import type { Polygon as LPolygon, LatLng as LLatLng, LeafletEvent } from "leaflet"
import type { PolygonInstance, PolygonOptions, ListenerId } from "../Provider.interface"
import type { LatLng, Bounds } from "../../types"
import { fromLatLngBounds } from "./utils"

export class LeafletPolygonInstance implements PolygonInstance {
  private readonly listeners = new Map<ListenerId, { event: string; handler: (e: LeafletEvent) => void }>()
  private nextId = 1
  private visible = true
  private editable = false

  constructor(private readonly polygon: LPolygon) {}

  setPath(path: LatLng[]): void {
    this.polygon.setLatLngs(path.map(p => [p.lat, p.lng]))
  }

  getPath(): LatLng[] {
    // First ring of the polygon (single-ring is the common case here).
    const rings = this.polygon.getLatLngs() as unknown as LLatLng[] | LLatLng[][]
    const ring = (Array.isArray(rings[0]) ? rings[0] : rings) as LLatLng[]
    return ring.map(p => ({ lat: p.lat, lng: p.lng }))
  }

  setEditable(editable: boolean): void {
    this.editable = editable
  }

  isEditable(): boolean {
    return this.editable
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    const el = this.polygon.getElement() as HTMLElement | SVGElement | undefined
    if (el) el.style.display = visible ? "" : "none"
  }

  isVisible(): boolean {
    return this.visible
  }

  remove(): void {
    this.polygon.remove()
  }

  setOptions(options: Partial<PolygonOptions>): void {
    this.polygon.setStyle({
      color: options.strokeColor,
      opacity: options.strokeOpacity,
      weight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
    })
  }

  getBounds(): Bounds {
    return fromLatLngBounds(this.polygon.getBounds())
  }

  on(event: string, handler: (...args: unknown[]) => void): ListenerId {
    const id = this.nextId++
    const wrapped = (e: LeafletEvent) => handler(e)
    this.polygon.on(event, wrapped)
    this.listeners.set(id, { event, handler: wrapped })
    return id
  }

  off(id: ListenerId): void {
    const entry = this.listeners.get(id)
    if (entry) {
      this.polygon.off(entry.event, entry.handler)
      this.listeners.delete(id)
    }
  }

  getNativeInstance(): LPolygon {
    return this.polygon
  }
}
