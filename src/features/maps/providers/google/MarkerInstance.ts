/**
 * Google Maps implementation of MarkerInstance
 */

import type { MarkerInstance, ListenerId, IconConfig } from "../Provider.interface"
import type { LatLng } from "../../types"
import { toGoogleIcon } from "./utils"

export class GoogleMarkerInstance implements MarkerInstance {
  private nativeMarker: google.maps.Marker
  private listeners: Map<ListenerId, google.maps.MapsEventListener> = new Map()
  private listenerIdCounter = 0

  constructor(marker: google.maps.Marker) {
    this.nativeMarker = marker
  }

  getNativeInstance(): google.maps.Marker {
    return this.nativeMarker
  }

  setPosition(latlng: LatLng): void {
    this.nativeMarker.setPosition(latlng)
  }

  getPosition(): LatLng {
    const pos = this.nativeMarker.getPosition()
    if (!pos) throw new Error("Marker position not available")
    return { lat: pos.lat(), lng: pos.lng() }
  }

  setVisible(visible: boolean): void {
    this.nativeMarker.setVisible(visible)
  }

  isVisible(): boolean {
    return this.nativeMarker.getVisible() || false
  }

  setDraggable(draggable: boolean): void {
    this.nativeMarker.setDraggable(draggable)
  }

  isDraggable(): boolean {
    return this.nativeMarker.getDraggable() || false
  }

  setIcon(icon: string | IconConfig): void {
    const googleIcon = toGoogleIcon(icon)
    this.nativeMarker.setIcon(googleIcon || null)
  }

  private static rotationCache: Map<string, string> = new Map()

  setRotation(rotation: number): void {
    const icon = this.nativeMarker.getIcon()
    if (!icon) return

    if (typeof icon === "object" && "path" in icon) {
      // It's a symbol, it has native rotation
      this.nativeMarker.setIcon({ ...icon, rotation })
      return
    }

    if (typeof icon === "object" && "url" in icon && icon.url) {
      const url = icon.url
      const cacheKey = `${url}_${rotation}`

      if (GoogleMarkerInstance.rotationCache.has(cacheKey)) {
        this.nativeMarker.setIcon({
          ...icon,
          url: GoogleMarkerInstance.rotationCache.get(cacheKey)!,
        })
        return
      }

      // Create a canvas to rotate the icon
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = url
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const size = Math.max(img.width, img.height)
        canvas.width = size
        canvas.height = size

        ctx.translate(size / 2, size / 2)
        ctx.rotate((rotation * Math.PI) / 180)
        ctx.drawImage(img, -img.width / 2, -img.height / 2)

        const rotatedUrl = canvas.toDataURL()
        GoogleMarkerInstance.rotationCache.set(cacheKey, rotatedUrl)

        this.nativeMarker.setIcon({
          ...icon,
          url: rotatedUrl,
        })
      }
    }
  }

  remove(): void {
    this.nativeMarker.setMap(null)
    this.listeners.forEach(listener => google.maps.event.removeListener(listener))
    this.listeners.clear()
  }

  on(event: string, handler: (...args: unknown[]) => void): ListenerId {
    const listenerId = ++this.listenerIdCounter
    const googleListener = this.nativeMarker.addListener(event, handler)
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
}
