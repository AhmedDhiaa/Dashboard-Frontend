/**
 * LeafletMarkerInstance — wraps a native Leaflet `Marker`.
 *
 * Visibility is implemented via opacity (Leaflet has no `setVisible`).
 * Rotation is a no-op: Leaflet markers don't rotate without a plugin, and the
 * free-map use cases (pins, boundary editing) don't need heading rotation.
 */

import type { Marker as LMarker, LeafletEvent } from "leaflet"
import type { MarkerInstance, IconConfig, ListenerId } from "../Provider.interface"
import type { LatLng } from "../../types"
import { toLeafletIcon, type LeafletModule } from "./utils"

export class LeafletMarkerInstance implements MarkerInstance {
  private readonly listeners = new Map<ListenerId, { event: string; handler: (e: LeafletEvent) => void }>()
  private nextId = 1
  private visible = true

  constructor(
    private readonly marker: LMarker,
    private readonly L: LeafletModule,
  ) {}

  setPosition(latlng: LatLng): void {
    this.marker.setLatLng([latlng.lat, latlng.lng])
  }

  getPosition(): LatLng {
    const p = this.marker.getLatLng()
    return { lat: p.lat, lng: p.lng }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.marker.setOpacity(visible ? 1 : 0)
  }

  isVisible(): boolean {
    return this.visible
  }

  setDraggable(draggable: boolean): void {
    if (draggable) this.marker.dragging?.enable()
    else this.marker.dragging?.disable()
  }

  isDraggable(): boolean {
    return this.marker.dragging?.enabled() ?? false
  }

  setIcon(icon: string | IconConfig): void {
    this.marker.setIcon(toLeafletIcon(this.L, icon))
  }

  setRotation(): void {
    /* no-op — Leaflet markers don't support rotation without a plugin */
  }

  remove(): void {
    this.marker.remove()
  }

  on(event: string, handler: (...args: unknown[]) => void): ListenerId {
    const id = this.nextId++
    const wrapped = (e: LeafletEvent) => handler(e)
    this.marker.on(event, wrapped)
    this.listeners.set(id, { event, handler: wrapped })
    return id
  }

  off(id: ListenerId): void {
    const entry = this.listeners.get(id)
    if (entry) {
      this.marker.off(entry.event, entry.handler)
      this.listeners.delete(id)
    }
  }

  getNativeInstance(): LMarker {
    return this.marker
  }
}
