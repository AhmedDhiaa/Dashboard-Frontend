/**
 * Boundary Feature - Manages polygon boundaries for areas/cities
 * Optimized with icon caching, marker pooling, and polygon simplification
 */

import { logger } from "@/shared/logger"
import { BaseFeature } from "../Feature.interface"
import type { PolygonInstance, MarkerInstance } from "../../providers/Provider.interface"
import type { Coordinate } from "../../types"
import { MarkerPool } from "../../utils/markerPool"
import type { BoundaryCtx, BoundaryFeatureConfig, BoundaryFeatureState } from "./boundary/types"
import { clearVertexMarkers } from "./boundary/markers"
import { createBoundary as createBoundaryImpl, performUpdate } from "./boundary/lifecycle"

export type { BoundaryFeatureConfig, BoundaryFeatureState } from "./boundary/types"

export class BoundaryFeature extends BaseFeature<BoundaryFeatureConfig, BoundaryFeatureState> {
  readonly metadata = {
    name: "boundaries",
    version: "1.0.1",
    description: "Polygon boundary editing with marker pooling and simplification",
  }

  private polygon: PolygonInstance | null = null
  private vertexMarkers: MarkerInstance[] = []
  private edgePolylines: google.maps.Polyline[] = []
  private isUpdatingFromInternal = false
  private isDestroying = false
  private markerPool: MarkerPool | null = null
  private pathChangeTimeout: ReturnType<typeof setTimeout> | null = null

  private ctx: BoundaryCtx = this.createCtx()

  private createCtx(): BoundaryCtx {
    // Object-literal getter/setter functions get their own `this`, so we need
    // a stable reference to forward private-field reads/writes back to this
    // class instance. Arrow getters aren't valid syntax inside object literals.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return {
      get map() {
        return self.map
      },
      get provider() {
        return self.provider
      },
      get config() {
        return self.config
      },
      get featureState() {
        return self.state
      },
      get polygon() {
        return self.polygon
      },
      set polygon(v) {
        self.polygon = v
      },
      get vertexMarkers() {
        return self.vertexMarkers
      },
      set vertexMarkers(v) {
        self.vertexMarkers = v
      },
      get edgePolylines() {
        return self.edgePolylines
      },
      set edgePolylines(v) {
        self.edgePolylines = v
      },
      get isUpdatingFromInternal() {
        return self.isUpdatingFromInternal
      },
      set isUpdatingFromInternal(v) {
        self.isUpdatingFromInternal = v
      },
      get isDestroying() {
        return self.isDestroying
      },
      set isDestroying(v) {
        self.isDestroying = v
      },
      get markerPool() {
        return self.markerPool
      },
      set markerPool(v) {
        self.markerPool = v
      },
      get pathChangeTimeout() {
        return self.pathChangeTimeout
      },
      set pathChangeTimeout(v) {
        self.pathChangeTimeout = v
      },
      setData: (data: BoundaryFeatureState) => {
        self.data = data
      },
      notifyListeners: () => self.notifyListeners(),
      getBoundaries: () => self.getBoundaries(),
      clearBoundary: () => self.clearBoundary(),
    }
  }

  protected async onInitialize(config: BoundaryFeatureConfig): Promise<void> {
    logger.info("[BoundaryFeature] Initializing...")

    this.data = {
      hasBoundary: false,
      pointCount: 0,
    }

    if (config.enableMarkerPooling !== false && this.provider?.createMarker) {
      this.markerPool = new MarkerPool(
        () =>
          this.provider!.createMarker!({
            position: { lat: 0, lng: 0 },
            map: this.map!,
            draggable: true,
            visible: false,
            zIndex: 1001,
          }),
        150,
      )
      logger.info("[BoundaryFeature] Marker pool initialized")
    }

    try {
      if (config.initialBoundaries?.length) {
        if (config.initialBoundaries.length < 3) {
          logger.warn("[BoundaryFeature] Insufficient points for polygon (need at least 3)")
          return
        }
        createBoundaryImpl(this.ctx, config.initialBoundaries)
      }
    } catch (error) {
      logger.error("[BoundaryFeature] Initialization failed:", error)
      throw error
    }
  }

  protected onUpdate(config: BoundaryFeatureConfig): void {
    performUpdate(this.ctx, config)
  }

  protected onEnable(): void {
    logger.info("[BoundaryFeature] Enabled")
    if (this.polygon) {
      this.polygon.setVisible(true)
    }
  }

  protected onDisable(): void {
    const currentBoundaries = this.polygon ? this.getBoundaries() : []
    logger.info(`[BoundaryFeature] Disabled - polygon has ${currentBoundaries.length} points`)

    if (this.polygon && currentBoundaries.length === 0) {
      this.polygon.setVisible(false)
    }
  }

  protected onDestroy(): void {
    logger.info("[BoundaryFeature] Destroying...")
    this.isDestroying = true
    if (this.pathChangeTimeout) {
      clearTimeout(this.pathChangeTimeout)
      this.pathChangeTimeout = null
    }
    this.clearBoundary()
    clearVertexMarkers(this.ctx)

    this.edgePolylines.forEach(polyline => polyline.setMap(null))
    this.edgePolylines = []

    if (this.markerPool) {
      this.markerPool.clear()
      this.markerPool = null
    }
  }

  public hasPolygon(): boolean {
    return !!this.polygon
  }

  public clearBoundary(): void {
    if (this.polygon) {
      this.polygon.remove()
      this.polygon = null
    }
    clearVertexMarkers(this.ctx)
    this.data = { hasBoundary: false, pointCount: 0 }
    this.notifyListeners()
    if (!this.isDestroying && this.config?.onBoundariesChange) this.config.onBoundariesChange([])
    logger.info("[BoundaryFeature] Cleared")
  }

  public getBoundaries(): Coordinate[] {
    if (!this.polygon) return []
    return this.polygon.getPath().map((p, i) => ({ latitude: p.lat, longitude: p.lng, sequence: i }))
  }

  public setBoundaries(boundaries: Coordinate[]): void {
    createBoundaryImpl(this.ctx, boundaries)
  }
}
