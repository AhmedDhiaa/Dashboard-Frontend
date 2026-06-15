import { logger } from "@/shared/logger"
import type { Coordinate } from "../../../types"
import type { BoundaryCtx, BoundaryFeatureConfig } from "./types"
import { simplifyBoundariesIfNeeded, validateBoundaries, pointsChanged } from "./utils"
import { synchronizeVertexMarkers } from "./markers"

export function handlePointsChange(ctx: BoundaryCtx, newPoints: Coordinate[]): void {
  if (newPoints.length >= 3) {
    logger.info(`[BoundaryFeature] Path external update: ${newPoints.length} points`)
    if (ctx.polygon) {
      const path = newPoints.map(p => ({ lat: p.latitude, lng: p.longitude }))
      ctx.polygon.setPath(path)
      ctx.setData({ hasBoundary: true, pointCount: newPoints.length })
    } else {
      createBoundary(ctx, newPoints)
    }
  } else if (newPoints.length === 0 && ctx.polygon) {
    const currentPoints = ctx.getBoundaries()
    if (currentPoints.length === 0) {
      logger.info("[BoundaryFeature] Clearing empty boundary")
      ctx.clearBoundary()
    }
  }
}

export function updatePolygonVisibility(ctx: BoundaryCtx, _config: BoundaryFeatureConfig): void {
  if (!ctx.polygon) return

  const currentBoundaries = ctx.getBoundaries()
  const shouldBeVisible = ctx.featureState === "enabled" || currentBoundaries.length > 0
  ctx.polygon.setVisible(shouldBeVisible)

  ctx.polygon.setEditable(false)
  synchronizeVertexMarkers(ctx)
}

export function performUpdate(ctx: BoundaryCtx, config: BoundaryFeatureConfig): void {
  try {
    if (!ctx.map) return

    if (ctx.isUpdatingFromInternal) {
      ctx.isUpdatingFromInternal = false
      return
    }

    const newPoints = config.initialBoundaries || []
    const currentPoints = ctx.getBoundaries()

    if (pointsChanged(newPoints, currentPoints)) {
      handlePointsChange(ctx, newPoints)
    }

    updatePolygonVisibility(ctx, config)
  } catch (error) {
    logger.error("[BoundaryFeature] Update failed:", error)
  }
}

export function createBoundary(ctx: BoundaryCtx, boundaries: Coordinate[]): void {
  if (!ctx.map || !ctx.config || !validateBoundaries(boundaries)) return

  const processedBoundaries = simplifyBoundariesIfNeeded(boundaries, ctx.config)

  if (ctx.polygon) {
    try {
      ctx.polygon.remove()
    } catch (e) {
      logger.warn(String(e))
    }
    ctx.polygon = null
  }

  try {
    const path = processedBoundaries.map(b => ({ lat: b.latitude, lng: b.longitude }))
    if (!ctx.provider?.createPolygon) throw new Error("Missing createPolygon")

    ctx.polygon = ctx.provider.createPolygon({
      paths: path,
      map: ctx.map,
      fillColor: ctx.config.fillColor || "#3b82f6",
      fillOpacity: ctx.config.fillOpacity ?? 0.15,
      strokeColor: ctx.config.strokeColor || "#1e40af",
      strokeWeight: ctx.config.strokeWeight ?? 1.5,
      editable: false, // Always false, we use custom markers for both modes
      draggable: false,
      visible: true,
    })

    if (!ctx.polygon) throw new Error("Failed to create polygon")

    setupPolygonListeners(ctx)
    ctx.setData({ hasBoundary: true, pointCount: processedBoundaries.length })
    ctx.notifyListeners()

    try {
      ctx.map.fitBounds(ctx.polygon.getBounds())
    } catch (e) {
      logger.warn(String(e))
    }

    synchronizeVertexMarkers(ctx)
    notifyBoundariesChange(ctx, processedBoundaries)
  } catch (error) {
    logger.error("[BoundaryFeature] ❌ Failed:", error)
    ctx.polygon = null
    ctx.setData({ hasBoundary: false, pointCount: 0 })
  }
}

export function setupPolygonListeners(ctx: BoundaryCtx): void {
  if (!ctx.polygon || !ctx.config?.onBoundariesChange) return
  const events = ["path_changed", "insert_at", "remove_at", "set_at"]
  events.forEach(event => {
    ctx.polygon!.on(event, () => handlePathChange(ctx))
  })
}

export function notifyBoundariesChange(ctx: BoundaryCtx, boundaries: Coordinate[]): void {
  if (!ctx.config?.onBoundariesChange) return
  const coords = boundaries.map((b, index) => ({
    latitude: b.latitude,
    longitude: b.longitude,
    sequence: index,
  }))
  ctx.config.onBoundariesChange(coords)
}

export function handlePathChange(ctx: BoundaryCtx): void {
  if (!ctx.polygon || !ctx.config?.onBoundariesChange) return

  if (ctx.pathChangeTimeout) clearTimeout(ctx.pathChangeTimeout)

  ctx.pathChangeTimeout = setTimeout(() => {
    try {
      const path = ctx.polygon!.getPath()
      if (!path || path.length === 0) return

      const boundaries: Coordinate[] = path.map((point, index) => ({
        latitude: point.lat,
        longitude: point.lng,
        sequence: index,
      }))

      ctx.setData({ hasBoundary: true, pointCount: boundaries.length })
      ctx.isUpdatingFromInternal = true
      ctx.notifyListeners()
      notifyBoundariesChange(ctx, boundaries)

      setTimeout(() => synchronizeVertexMarkers(ctx), 50)
    } catch (error) {
      logger.error("[BoundaryFeature] Failed path change:", error)
    }
  }, 100)
}
