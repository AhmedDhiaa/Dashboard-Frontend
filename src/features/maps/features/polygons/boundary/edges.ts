import type { BoundaryCtx } from "./types"
import { handlePathChange } from "./lifecycle"
import { safeSetNativeMapOptions } from "../../../utils/nativeMapOptions"

export function synchronizeEdgePolylines(ctx: BoundaryCtx): void {
  // Editable edge polylines are a Google-Maps-only enhancement (they use
  // google.maps.Polyline + event listeners). On other providers (e.g. Leaflet)
  // they can't render and would throw, so skip them entirely — the boundary
  // polygon and its vertex markers still render through the provider interface.
  if (ctx.provider && ctx.provider.name !== "google") {
    ctx.edgePolylines.forEach(p => p.setMap(null))
    ctx.edgePolylines = []
    return
  }
  if (!ctx.map || !ctx.polygon || !ctx.config || ctx.config.editable === false) {
    ctx.edgePolylines.forEach(p => p.setMap(null))
    ctx.edgePolylines = []
    return
  }

  const path = ctx.polygon.getPath()
  const pathLength = path.length
  ctx.edgePolylines.forEach(p => p.setMap(null))
  ctx.edgePolylines = []

  for (let i = 0; i < pathLength; i++) {
    const start = path[i]
    const end = path[(i + 1) % pathLength]
    if (!start || !end) continue

    const edge = new google.maps.Polyline({
      path: [start, end],
      map: ctx.map.getNativeInstance() as google.maps.Map,
      strokeColor: ctx.config.strokeColor || "#1e40af",
      strokeOpacity: 0,
      strokeWeight: 12,
      clickable: true,
      zIndex: 1000,
    })

    google.maps.event.addListener(edge, "click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !ctx.polygon) return
      const p = ctx.polygon.getPath()
      p.splice((i + 1) % (pathLength + 1), 0, { lat: e.latLng.lat(), lng: e.latLng.lng() })
      ctx.polygon.setPath(p)
      handlePathChange(ctx)
    })

    setupEdgeHover(ctx, edge)
    ctx.edgePolylines.push(edge)
  }
}

export function setupEdgeHover(ctx: BoundaryCtx, edge: google.maps.Polyline): void {
  google.maps.event.addListener(edge, "mouseover", () => {
    edge.setOptions({ strokeOpacity: 0.4, strokeColor: ctx.config!.strokeColor || "#1e40af" })
    safeSetNativeMapOptions(ctx.map?.getNativeInstance(), { draggableCursor: "crosshair" })
  })
  google.maps.event.addListener(edge, "mouseout", () => {
    edge.setOptions({ strokeOpacity: 0 })
    safeSetNativeMapOptions(ctx.map?.getNativeInstance(), { draggableCursor: null })
  })
}
