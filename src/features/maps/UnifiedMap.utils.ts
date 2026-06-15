/**
 * UnifiedMap helper utilities and shared instance types.
 */

import { logger } from "@/shared/logger"
import { featureRegistry, BaseFeature } from "./features"

// Type definitions for feature instances
export interface DrawingFeatureInstance extends Omit<BaseFeature, "config"> {
  startDrawing: (mode: "polygon" | "circle") => Promise<void>
  stopDrawing: () => void
  deleteCurrentShape?: () => void
  config?: Record<string, unknown>
}

export interface BoundaryFeatureInstance extends Omit<BaseFeature, "config"> {
  clearBoundary?: () => void
  polygon?: google.maps.Polygon
  initialBoundaries?: Array<{ lat: number; lng: number }>
}

/**
 * Helper function to get drawing feature with type safety
 */
export function getDrawingFeatureInstance(isReady: boolean, map: unknown): DrawingFeatureInstance | null {
  if (!isReady || !map) {
    logger.warn("[MapControlsWrapper] Map not ready, cannot access drawing feature")
    return null
  }

  const drawingFeature = featureRegistry.getFeature("drawing")

  if (!drawingFeature) {
    logger.error(
      "[MapControlsWrapper] Drawing feature not found in registry. Available features:",
      featureRegistry.getActiveFeatures(),
    )
    return null
  }

  if (!drawingFeature.isEnabled()) {
    logger.warn("[MapControlsWrapper] Drawing feature exists but is not enabled. State:", drawingFeature.getState())
    return null
  }

  const typedFeature = drawingFeature as DrawingFeatureInstance
  if (typeof typedFeature.startDrawing !== "function") {
    logger.error("[MapControlsWrapper] Drawing feature does not have startDrawing method")
    return null
  }

  return typedFeature
}

/**
 * Helper function to handle boundary clearing
 */
export function handleBoundaryClear() {
  const boundaryFeature = featureRegistry.getFeature("boundaries") as BoundaryFeatureInstance | null
  if (boundaryFeature && typeof boundaryFeature.clearBoundary === "function") {
    try {
      boundaryFeature.clearBoundary()
    } catch (error) {
      logger.error("[MapControlsWrapper] Error clearing boundary:", error)
    }
  }

  const drawingFeature = featureRegistry.getFeature("drawing") as DrawingFeatureInstance | null
  if (drawingFeature && typeof drawingFeature.deleteCurrentShape === "function") {
    try {
      drawingFeature.deleteCurrentShape()
      logger.info("[MapControlsWrapper] Drawing shape deleted")
    } catch (error) {
      logger.error("[MapControlsWrapper] Error deleting drawing shape:", error)
    }
  }
}
