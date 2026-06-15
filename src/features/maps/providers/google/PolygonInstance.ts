/**
 * Google Maps implementation of PolygonInstance
 */

import type { PolygonInstance, ListenerId, PolygonOptions } from "../Provider.interface"
import type { LatLng, Bounds } from "../../types"
import { isCompositePathListener, type CompositePathListener } from "./types"

export class GooglePolygonInstance implements PolygonInstance {
  private nativePolygon: google.maps.Polygon
  private listeners: Map<ListenerId, google.maps.MapsEventListener | CompositePathListener> = new Map()
  private listenerIdCounter = 0

  constructor(polygon: google.maps.Polygon) {
    this.nativePolygon = polygon
  }

  getNativeInstance(): google.maps.Polygon {
    return this.nativePolygon
  }

  setPath(path: LatLng[]): void {
    this.nativePolygon.setPath(path)

    // Crucial: If we have path_changed listeners, they were attached to the OLD path object.
    // We need to find them and re-attach them to the NEW path object.
    const pathChangedListeners = Array.from(this.listeners.entries()).filter(
      ([id]) => typeof id === "string" && id.includes("_path_changed"),
    )

    if (pathChangedListeners.length > 0) {
      const newPath = this.nativePolygon.getPath()
      pathChangedListeners.forEach(([id, listenerInfo]) => {
        // Remove old composite listener components
        this.releaseListener(listenerInfo)

        // Only proceed if it's a composite path listener
        if (!isCompositePathListener(listenerInfo)) return

        const handler = listenerInfo.handler
        const setAtListener = newPath.addListener("set_at", handler)
        const insertAtListener = newPath.addListener("insert_at", handler)
        const removeAtListener = newPath.addListener("remove_at", handler)

        // Update stored listener info
        const compositeListener: CompositePathListener = {
          handler,
          setAtListener,
          insertAtListener,
          removeAtListener,
          googleListener: setAtListener,
        }
        this.listeners.set(id, compositeListener)
      })
    }
  }

  getPath(): LatLng[] {
    const path = this.nativePolygon.getPath()
    const result: LatLng[] = []

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      result.push({ lat: point.lat(), lng: point.lng() })
    }

    return result
  }

  setEditable(editable: boolean): void {
    this.nativePolygon.setEditable(editable)
  }

  isEditable(): boolean {
    return this.nativePolygon.getEditable() || false
  }

  setVisible(visible: boolean): void {
    this.nativePolygon.setVisible(visible)
  }

  isVisible(): boolean {
    return this.nativePolygon.getVisible() || false
  }

  setOptions(options: Partial<PolygonOptions>): void {
    this.nativePolygon.setOptions({
      strokeColor: options.strokeColor,
      strokeOpacity: options.strokeOpacity,
      strokeWeight: options.strokeWeight,
      fillColor: options.fillColor,
      fillOpacity: options.fillOpacity,
      editable: options.editable,
      draggable: options.draggable,
      visible: options.visible,
    })
  }

  remove(): void {
    this.nativePolygon.setMap(null)
    this.listeners.forEach(listener => this.releaseListener(listener))
    this.listeners.clear()
  }

  /**
   * Safe listener release that handles composite path listeners
   */
  private releaseListener(listener: google.maps.MapsEventListener | CompositePathListener): void {
    if (!listener) return

    if (isCompositePathListener(listener)) {
      // It's a composite path listener
      google.maps.event.removeListener(listener.setAtListener)
      google.maps.event.removeListener(listener.insertAtListener)
      google.maps.event.removeListener(listener.removeAtListener)
    } else {
      // It's a standard Google listener
      google.maps.event.removeListener(listener)
    }
  }

  on(event: string, handler: (...args: unknown[]) => void): ListenerId {
    const listenerId = ++this.listenerIdCounter

    // Handle path events
    if (event === "path_changed") {
      const path = this.nativePolygon.getPath()

      const setAtListener = path.addListener("set_at", handler)
      const insertAtListener = path.addListener("insert_at", handler)
      const removeAtListener = path.addListener("remove_at", handler)

      // Store with a specific ID format so setPath can find them
      const pathId = `${listenerId}_path_changed`
      const compositeListener: CompositePathListener = {
        handler,
        setAtListener,
        insertAtListener,
        removeAtListener,
        googleListener: setAtListener,
      }
      this.listeners.set(pathId, compositeListener)
    } else {
      const googleListener = this.nativePolygon.addListener(event, handler)
      this.listeners.set(listenerId, googleListener)
    }

    return listenerId
  }

  off(id: ListenerId): void {
    const listener = this.listeners.get(id)
    if (listener) {
      this.releaseListener(listener)
      this.listeners.delete(id)
    } else {
      // Check for path_changed listeners if they were stored with specific suffix
      const pathId = `${id}_path_changed`
      const pathListener = this.listeners.get(pathId)
      if (pathListener) {
        this.releaseListener(pathListener)
        this.listeners.delete(pathId)
      }
    }
  }

  getBounds(): Bounds {
    const path = this.getPath()
    if (path.length === 0) {
      throw new Error("Cannot get bounds of empty polygon")
    }

    let north = path[0]!.lat
    let south = path[0]!.lat
    let east = path[0]!.lng
    let west = path[0]!.lng

    path.forEach(point => {
      if (point.lat > north) north = point.lat
      if (point.lat < south) south = point.lat
      if (point.lng > east) east = point.lng
      if (point.lng < west) west = point.lng
    })

    return { north, south, east, west }
  }
}
