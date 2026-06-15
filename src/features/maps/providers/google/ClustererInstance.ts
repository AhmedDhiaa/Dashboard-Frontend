/**
 * Google Maps implementation of ClustererInstance
 */

import { MarkerClusterer } from "@googlemaps/markerclusterer"
import type { ClustererInstance, MarkerInstance } from "../Provider.interface"

export class GoogleClustererInstance implements ClustererInstance {
  private nativeClusterer: MarkerClusterer

  constructor(clusterer: MarkerClusterer) {
    this.nativeClusterer = clusterer
  }

  addMarker(marker: MarkerInstance): void {
    this.nativeClusterer.addMarker(marker.getNativeInstance() as google.maps.Marker)
  }

  addMarkers(markers: MarkerInstance[]): void {
    this.nativeClusterer.addMarkers(markers.map(m => m.getNativeInstance() as google.maps.Marker))
  }

  removeMarker(marker: MarkerInstance): void {
    this.nativeClusterer.removeMarker(marker.getNativeInstance() as google.maps.Marker)
  }

  clearMarkers(): void {
    this.nativeClusterer.clearMarkers()
  }

  render(): void {
    this.nativeClusterer.render()
  }
}
