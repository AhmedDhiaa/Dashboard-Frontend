import type { MarkerInstance } from "../../../providers/Provider.interface"
import type { BoundaryCtx } from "./types"
import { getPointIcon } from "./utils"
import { synchronizeEdgePolylines } from "./edges"
import { handlePathChange } from "./lifecycle"

export function clearVertexMarkers(ctx: BoundaryCtx): void {
  if (ctx.markerPool) {
    ctx.vertexMarkers.forEach(marker => ctx.markerPool!.release(marker))
  } else {
    ctx.vertexMarkers.forEach(marker => marker.remove())
  }
  ctx.vertexMarkers = []
  ctx.edgePolylines.forEach(polyline => polyline.setMap(null))
  ctx.edgePolylines = []
}

export function synchronizeVertexMarkers(ctx: BoundaryCtx): void {
  if (!ctx.map || !ctx.polygon || !ctx.config) {
    clearVertexMarkers(ctx)
    return
  }

  const { visible = true } = ctx.config.pointOptions || {}
  if (!visible) {
    clearVertexMarkers(ctx)
    return
  }

  const path = ctx.polygon.getPath()
  const pathLength = path.length
  const markerCount = ctx.vertexMarkers.length

  if (markerCount === pathLength) {
    path.forEach((latlng, index) => {
      const marker = ctx.vertexMarkers[index]
      if (marker) {
        marker.setPosition(latlng)
        marker.setDraggable(ctx.config?.editable !== false)
        marker.setVisible(true)
      }
    })
  } else if (markerCount < pathLength) {
    path.forEach((latlng, index) => {
      if (index < markerCount) {
        ctx.vertexMarkers[index]!.setPosition(latlng)
      } else {
        const marker = createVertexMarker(ctx, latlng, index)
        if (marker) ctx.vertexMarkers.push(marker)
      }
    })
  } else {
    const markersToRemove = ctx.vertexMarkers.splice(pathLength)
    markersToRemove.forEach(marker => (ctx.markerPool ? ctx.markerPool!.release(marker) : marker.remove()))
    path.forEach((latlng, index) => ctx.vertexMarkers[index]!.setPosition(latlng))
  }

  synchronizeEdgePolylines(ctx)
}

export function createVertexMarker(
  ctx: BoundaryCtx,
  latlng: { lat: number; lng: number },
  index: number,
): MarkerInstance | null {
  if (!ctx.provider?.createMarker || !ctx.map) return null

  const isDraggable = ctx.config?.editable !== false
  let marker: MarkerInstance | null = ctx.markerPool ? ctx.markerPool.acquire() : null
  if (marker) {
    marker.setPosition(latlng)
    marker.setDraggable(isDraggable)
    const icon = getPointIcon(ctx.config, index)
    if (icon) marker.setIcon(icon)
  } else {
    marker = ctx.provider.createMarker({
      position: latlng,
      map: ctx.map,
      draggable: isDraggable,
      icon: getPointIcon(ctx.config, index),
      zIndex: 1001,
    })
  }

  if (marker) {
    marker.on("dragstart", () => ctx.polygon?.setEditable(false))
    marker.on("drag", () => {
      if (ctx.polygon) {
        const path = ctx.polygon.getPath()
        path[index] = marker!.getPosition()
        ctx.polygon.setPath(path)
      }
    })
    marker.on("dragend", () => {
      if (ctx.polygon) {
        const path = ctx.polygon.getPath()
        path[index] = marker!.getPosition()
        ctx.polygon.setPath(path)
        handlePathChange(ctx)
      }
    })
  }
  return marker
}
