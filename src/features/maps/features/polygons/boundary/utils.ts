import { logger } from "@/shared/logger"
import type { Coordinate } from "../../../types"
import type { IconConfig } from "../../../providers/Provider.interface"
import { createShapeIcon, type ShapeType } from "../../../utils/iconFactory"
import { simplifyPolygon, shouldSimplify, getPolygonMetrics } from "../../../utils/polygonSimplification"
import type { BoundaryFeatureConfig } from "./types"

export function validateBoundaries(boundaries: Coordinate[]): boolean {
  if (!boundaries || boundaries.length < 3) {
    logger.error("[BoundaryFeature] Invalid boundaries: need at least 3 points")
    return false
  }

  const invalidCoords = boundaries.filter(
    b =>
      typeof b.latitude !== "number" ||
      typeof b.longitude !== "number" ||
      b.latitude < -90 ||
      b.latitude > 90 ||
      b.longitude < -180 ||
      b.longitude > 180,
  )

  if (invalidCoords.length > 0) {
    logger.error(`[BoundaryFeature] Invalid coordinates found: ${invalidCoords.length}`)
    return false
  }

  return true
}

export function simplifyBoundariesIfNeeded(
  boundaries: Coordinate[],
  config: BoundaryFeatureConfig | null,
): Coordinate[] {
  if (config?.enableSimplification === true && shouldSimplify(boundaries)) {
    const metrics = getPolygonMetrics(boundaries)
    const tolerance = config?.simplificationTolerance || 0.0001
    const simplified = simplifyPolygon(boundaries, tolerance)

    const reduction = (((boundaries.length - simplified.length) / boundaries.length) * 100).toFixed(1)
    logger.info(`[BoundaryFeature] 📊 Simplified: ${boundaries.length} → ${simplified.length} (${reduction}%)`)
    logger.debug(`[BoundaryFeature] Perimeter: ${metrics.perimeter.toFixed(6)}`)

    return simplified
  }
  return boundaries
}

export function getPointIcon(config: BoundaryFeatureConfig | null, _index: number): string | IconConfig | undefined {
  const { shape = "circle", icon } = config?.pointOptions || {}
  if (icon) return icon as string | IconConfig

  return createShapeIcon((shape || "circle") as ShapeType, "#ffffff", config?.strokeColor || "#1e40af")
}

export function pointsChanged(newPoints: Coordinate[], currentPoints: Coordinate[]): boolean {
  return (
    newPoints.length !== currentPoints.length ||
    newPoints.some((p, i) => p.latitude !== currentPoints[i]?.latitude || p.longitude !== currentPoints[i]?.longitude)
  )
}
