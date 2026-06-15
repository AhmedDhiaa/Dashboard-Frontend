/**
 * Drawing Feature - Provides drawing tools for creating shapes
 */

import { logger } from "@/shared/logger"
import { BaseFeature } from "../Feature.interface"
import type { FeatureConfig } from "../Feature.interface"
import type { Coordinate } from "../../types"
import { safeSetNativeMapOptions } from "../../utils/nativeMapOptions"

export type DrawingMode = "marker" | "polygon" | "polyline" | "circle" | "rectangle"

export interface DrawingFeatureConfig extends FeatureConfig {
  modes?: DrawingMode[]
  showControls?: boolean
  onShapeComplete?: (shape: Coordinate[], type: DrawingMode) => void
  onClearShape?: () => void
  shouldClearAfterComplete?: boolean
  polygonOptions?: {
    fillColor?: string
    strokeColor?: string
    fillOpacity?: number
    strokeWeight?: number
  }
  circleOptions?: {
    fillColor?: string
    strokeColor?: string
    fillOpacity?: number
    strokeWeight?: number
  }
}

export interface DrawingFeatureState {
  currentMode: DrawingMode | null
  isDrawing: boolean
}

export class DrawingFeature extends BaseFeature<DrawingFeatureConfig, DrawingFeatureState> {
  readonly metadata = {
    name: "drawing",
    version: "1.0.0",
    description: "Drawing tools for creating shapes",
    dependencies: [],
  }

  private drawingManager: google.maps.drawing.DrawingManager | null = null
  private currentShape: google.maps.MVCObject | null = null

  protected async onInitialize(_config: DrawingFeatureConfig): Promise<void> {
    logger.info("[DrawingFeature] Initializing...")
    this.data = { currentMode: null, isDrawing: false }
  }

  protected onUpdate(config: DrawingFeatureConfig): void {
    if (this.drawingManager && config.polygonOptions) {
      this.drawingManager.setOptions({
        polygonOptions: {
          fillColor: config.polygonOptions.fillColor || "#3b82f6",
          fillOpacity: config.polygonOptions.fillOpacity ?? 0.35,
          strokeColor: config.polygonOptions.strokeColor || "#1e40af",
          strokeWeight: config.polygonOptions.strokeWeight ?? 2,
          editable: true,
          clickable: true,
          zIndex: 1,
        },
      })
    }
  }

  protected onEnable(): void {
    if (this.drawingManager && this.map) {
      this.drawingManager.setMap(this.map.getNativeInstance() as google.maps.Map)
    }
  }

  protected onDisable(): void {
    if (this.drawingManager) {
      this.drawingManager.setMap(null)
      this.setDrawingMode(null)
    }
  }

  protected onDestroy(): void {
    this.stopDrawing()
    if (this.drawingManager) {
      this.drawingManager.setMap(null)
      this.drawingManager = null
    }
  }

  private ensureDrawingManager(): boolean {
    if (this.drawingManager) return true
    if (typeof window === "undefined") return false

    if (!window.google?.maps?.drawing) return false

    this.initializeDrawingManager()
    return true
  }

  private initializeDrawingManager(): void {
    if (!this.map || !this.config) return

    const google = window.google
    const polygonOptions = this.config.polygonOptions || {}

    try {
      this.drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: this.config.showControls ?? false,
        drawingControlOptions: {
          position: google.maps.ControlPosition.TOP_CENTER,
          drawingModes: (this.config.modes as unknown as google.maps.drawing.OverlayType[]) || [
            google.maps.drawing.OverlayType.POLYGON,
          ],
        },
        polygonOptions: {
          fillColor: polygonOptions.fillColor || "#3b82f6",
          fillOpacity: polygonOptions.fillOpacity ?? 0.35,
          strokeColor: polygonOptions.strokeColor || "#1e40af",
          strokeWeight: polygonOptions.strokeWeight ?? 2,
          editable: true,
          draggable: false,
          clickable: true,
          zIndex: 1,
        },
      })

      this.drawingManager!.setMap(this.map.getNativeInstance() as google.maps.Map)

      google.maps.event.addListener(
        this.drawingManager!,
        "overlaycomplete",
        (event: google.maps.drawing.OverlayCompleteEvent) => {
          this.handleShapeComplete(event)
        },
      )
    } catch (error) {
      logger.error("[DrawingFeature] Init failed:", error)
    }
  }

  private async handleShapeComplete(event: google.maps.drawing.OverlayCompleteEvent): Promise<void> {
    const { overlay, type } = event
    if (!overlay) return

    if (this.currentShape) {
      ;(this.currentShape as google.maps.Polygon).setMap(null)
    }

    this.currentShape = overlay
    const nativeMap = this.map?.getNativeInstance() as google.maps.Map

    if (nativeMap && "setMap" in overlay) {
      ;(overlay as google.maps.Polygon).setMap(nativeMap)
    }

    if ("setEditable" in overlay) {
      ;(overlay as google.maps.Polygon).setEditable(true)
    }

    const boundaries: Coordinate[] = []

    if (type === google.maps.drawing.OverlayType.POLYGON) {
      const polygon = overlay as google.maps.Polygon
      const path = polygon.getPath()
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i)
        boundaries.push({ longitude: point.lng(), latitude: point.lat(), sequence: i })
      }
    } else if (type === google.maps.drawing.OverlayType.CIRCLE) {
      const circle = overlay as google.maps.Circle
      const center = circle.getCenter()
      const radius = circle.getRadius()
      if (center) {
        const points = radius < 500 ? 16 : 32
        for (let i = 0; i < points; i++) {
          const angle = (i * 2 * Math.PI) / points
          const latOffset = (radius / 111320) * Math.cos(angle)
          const lngOffset = (radius / (111320 * Math.cos((center.lat() * Math.PI) / 180))) * Math.sin(angle)
          boundaries.push({ longitude: center.lng() + lngOffset, latitude: center.lat() + latOffset, sequence: i })
        }
      }
    }

    if (boundaries.length > 0) {
      this.config?.onShapeComplete?.(boundaries, type as unknown as DrawingMode)
    }

    if (this.config?.shouldClearAfterComplete) {
      setTimeout(() => this.clearCurrentShape(), 250)
    }

    this.setDrawingMode(null)
    safeSetNativeMapOptions(nativeMap, { draggable: true, clickableIcons: true, gestureHandling: "greedy" })

    this.data = { currentMode: null, isDrawing: false }
  }

  public setDrawingMode(mode: DrawingMode | null): void {
    if (!this.ensureDrawingManager() || !this.drawingManager) return

    try {
      if (mode === null) {
        this.drawingManager.setDrawingMode(null)
      } else {
        const google = window.google
        const googleMode =
          mode === "marker"
            ? google.maps.drawing.OverlayType.MARKER
            : mode === "polygon"
              ? google.maps.drawing.OverlayType.POLYGON
              : mode === "polyline"
                ? google.maps.drawing.OverlayType.POLYLINE
                : mode === "circle"
                  ? google.maps.drawing.OverlayType.CIRCLE
                  : google.maps.drawing.OverlayType.RECTANGLE
        this.drawingManager.setDrawingMode(googleMode)
      }
      this.data = { currentMode: mode, isDrawing: mode !== null }
      this.notifyListeners()
    } catch (err) {
      logger.error("[DrawingFeature] Mode set failed:", err)
    }
  }

  public clearCurrentShape(): void {
    if (this.currentShape) {
      ;(this.currentShape as unknown as google.maps.OverlayView).setMap(null)
      this.currentShape = null
      this.config?.onClearShape?.()
      this.notifyListeners()
    }
  }

  public startDrawing(mode: DrawingMode = "polygon"): void {
    if (!this.config || !this.map || this.state !== "enabled") return

    const nativeMap = this.map.getNativeInstance() as google.maps.Map
    if (!nativeMap || !window.google?.maps?.drawing) return

    this.clearCurrentShape()
    safeSetNativeMapOptions(nativeMap, { draggable: false, gestureHandling: "greedy" })

    if (!this.drawingManager) this.initializeDrawingManager()
    if (!this.drawingManager) return

    const google = window.google
    const googleMode =
      mode === "polygon"
        ? google.maps.drawing.OverlayType.POLYGON
        : mode === "circle"
          ? google.maps.drawing.OverlayType.CIRCLE
          : google.maps.drawing.OverlayType.RECTANGLE
    this.drawingManager.setDrawingMode(googleMode)
    this.data = { currentMode: mode, isDrawing: true }
    this.notifyListeners()
  }

  public stopDrawing(): void {
    if (this.drawingManager) {
      this.drawingManager.setDrawingMode(null)
      this.drawingManager.setMap(null)
      this.drawingManager = null
    }

    if (this.map) {
      const nativeMap = this.map.getNativeInstance() as google.maps.Map
      safeSetNativeMapOptions(nativeMap, { draggable: true, gestureHandling: "greedy" })
    }

    this.data = { currentMode: null, isDrawing: false }
    this.notifyListeners()
  }
}
