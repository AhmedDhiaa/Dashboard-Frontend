/**
 * LeafletClustererInstance — a pass-through clusterer.
 *
 * Visual clustering needs the `leaflet.markercluster` plugin, which the free
 * provider intentionally doesn't bundle. This implementation satisfies the
 * `ClustererInstance` contract by adding/removing the markers directly on the
 * map (no grouping), so callers that expect a clusterer keep working.
 */

import type { Map as LMap, Marker as LMarker } from "leaflet"
import type { ClustererInstance, MarkerInstance } from "../Provider.interface"

export class LeafletClustererInstance implements ClustererInstance {
  private readonly markers = new Set<MarkerInstance>()

  constructor(private readonly map: LMap) {}

  addMarker(marker: MarkerInstance): void {
    this.markers.add(marker)
    ;(marker.getNativeInstance() as LMarker).addTo(this.map)
  }

  addMarkers(markers: MarkerInstance[]): void {
    markers.forEach(m => this.addMarker(m))
  }

  removeMarker(marker: MarkerInstance): void {
    this.markers.delete(marker)
    ;(marker.getNativeInstance() as LMarker).remove()
  }

  clearMarkers(): void {
    this.markers.forEach(m => (m.getNativeInstance() as LMarker).remove())
    this.markers.clear()
  }

  render(): void {
    /* no-op — markers are added to the map as they arrive */
  }
}
