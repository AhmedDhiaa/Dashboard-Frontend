/**
 * Google Maps implementation of MapInstance
 */

import type { MapInstance, ListenerId, MapEventType, MapEventHandler, MapEvent } from "../Provider.interface"
import type { LatLng, Bounds } from "../../types"
import type { GoogleMapsEvent } from "./types"

export class GoogleMapInstance implements MapInstance {
  private nativeMap: google.maps.Map
  private listeners: Map<ListenerId, google.maps.MapsEventListener> = new Map()
  private listenerIdCounter = 0

  constructor(map: google.maps.Map) {
    this.nativeMap = map
  }

  getNativeInstance(): google.maps.Map {
    return this.nativeMap
  }

  setCenter(latlng: LatLng): void {
    this.nativeMap.setCenter(latlng)
  }

  setZoom(zoom: number): void {
    this.nativeMap.setZoom(zoom)
  }

  fitBounds(bounds: Bounds): void {
    const gmapsBounds = new google.maps.LatLngBounds(
      { lat: bounds.south, lng: bounds.west },
      { lat: bounds.north, lng: bounds.east },
    )
    this.nativeMap.fitBounds(gmapsBounds)
  }

  panTo(latlng: LatLng): void {
    this.nativeMap.panTo(latlng)
  }

  panBy(x: number, y: number): void {
    this.nativeMap.panBy(x, y)
  }

  getCenter(): LatLng {
    const center = this.nativeMap.getCenter()
    if (!center) throw new Error("Map center not available")
    return { lat: center.lat(), lng: center.lng() }
  }

  getZoom(): number {
    return this.nativeMap.getZoom() || 0
  }

  getBounds(): Bounds {
    const bounds = this.nativeMap.getBounds()
    if (!bounds) throw new Error("Map bounds not available")

    const ne = bounds.getNorthEast()
    const sw = bounds.getSouthWest()

    return {
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
    }
  }

  on(event: MapEventType, handler: MapEventHandler): ListenerId {
    const listenerId = ++this.listenerIdCounter

    const googleListener = this.nativeMap.addListener(event, (e: GoogleMapsEvent) => {
      const mapEvent: MapEvent = {
        type: event,
        target: this,
        originalEvent: e,
      }

      // Extract latlng if available
      if (e.latLng) {
        mapEvent.latlng = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng(),
        }
      }

      handler(mapEvent)
    })

    this.listeners.set(listenerId, googleListener)
    return listenerId
  }

  off(id: ListenerId): void {
    const listener = this.listeners.get(id)
    if (listener) {
      google.maps.event.removeListener(listener)
      this.listeners.delete(id)
    }
  }

  trigger(event: MapEventType, data?: unknown): void {
    google.maps.event.trigger(this.nativeMap, event, data)
  }

  getContainer(): HTMLElement {
    return this.nativeMap.getDiv()
  }

  resize(): void {
    google.maps.event.trigger(this.nativeMap, "resize")
  }

  isReady(): boolean {
    return !!this.nativeMap
  }

  destroy(): void {
    this.listeners.forEach(listener => google.maps.event.removeListener(listener))
    this.listeners.clear()
  }
}
