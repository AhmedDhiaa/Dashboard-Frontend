/**
 * LeafletMapInstance — wraps a native Leaflet `Map` behind our provider-
 * agnostic `MapInstance` contract (view manipulation, event bridging,
 * lifecycle).
 */

import type { Map as LMap, LeafletEvent, LeafletMouseEvent } from "leaflet"
import type {
  MapInstance,
  MapEventType,
  MapEventHandler,
  ListenerId,
} from "../Provider.interface"
import type { LatLng, Bounds } from "../../types"
import { LEAFLET_EVENT_MAP, fromLatLngBounds, toLatLngBounds, type LeafletModule } from "./utils"

type Padding = number | { top?: number; right?: number; bottom?: number; left?: number }

export class LeafletMapInstance implements MapInstance {
  private readonly listeners = new Map<ListenerId, { event: string; handler: (e: LeafletEvent) => void }>()
  private nextId = 1
  private ready = true

  constructor(
    private readonly map: LMap,
    private readonly L: LeafletModule,
  ) {}

  getNativeInstance(): LMap {
    return this.map
  }

  setCenter(latlng: LatLng): void {
    this.map.panTo([latlng.lat, latlng.lng])
  }

  setZoom(zoom: number): void {
    this.map.setZoom(zoom)
  }

  fitBounds(bounds: Bounds, options?: { padding?: Padding }): void {
    const p = options?.padding
    if (typeof p === "number") {
      this.map.fitBounds(toLatLngBounds(this.L, bounds), { padding: [p, p] })
    } else if (p) {
      this.map.fitBounds(toLatLngBounds(this.L, bounds), {
        paddingTopLeft: [p.left ?? 0, p.top ?? 0],
        paddingBottomRight: [p.right ?? 0, p.bottom ?? 0],
      })
    } else {
      this.map.fitBounds(toLatLngBounds(this.L, bounds))
    }
  }

  panTo(latlng: LatLng): void {
    this.map.panTo([latlng.lat, latlng.lng])
  }

  panBy(x: number, y: number): void {
    this.map.panBy([x, y])
  }

  getCenter(): LatLng {
    const c = this.map.getCenter()
    return { lat: c.lat, lng: c.lng }
  }

  getZoom(): number {
    return this.map.getZoom()
  }

  getBounds(): Bounds {
    return fromLatLngBounds(this.map.getBounds())
  }

  on(event: MapEventType, handler: MapEventHandler): ListenerId {
    const id = this.nextId++
    const name = LEAFLET_EVENT_MAP[event]
    if (!name) return id
    const wrapped = (e: LeafletEvent) => {
      const me = e as Partial<LeafletMouseEvent>
      handler({
        type: event,
        latlng: me.latlng ? { lat: me.latlng.lat, lng: me.latlng.lng } : undefined,
        point: me.containerPoint ? { x: me.containerPoint.x, y: me.containerPoint.y } : undefined,
        originalEvent: me.originalEvent,
        target: this,
      })
    }
    this.map.on(name, wrapped)
    this.listeners.set(id, { event: name, handler: wrapped })
    return id
  }

  off(id: ListenerId): void {
    const entry = this.listeners.get(id)
    if (entry) {
      this.map.off(entry.event, entry.handler)
      this.listeners.delete(id)
    }
  }

  trigger(event: MapEventType, data?: unknown): void {
    const name = LEAFLET_EVENT_MAP[event]
    if (name) this.map.fire(name, data as Record<string, unknown>)
  }

  getContainer(): HTMLElement {
    return this.map.getContainer()
  }

  resize(): void {
    this.map.invalidateSize()
  }

  isReady(): boolean {
    return this.ready
  }

  destroy(): void {
    this.listeners.clear()
    try {
      this.map.remove()
    } catch {
      /* container may already be torn down (StrictMode re-init) — best effort */
    }
    this.ready = false
  }
}
