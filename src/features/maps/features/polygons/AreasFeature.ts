/**
 * Areas Feature - Manages multiple static polygons (areas/zones) on the map
 * optimized for display-only scenarios with high performance
 */

import { logger } from "@/shared/logger"
import { BaseFeature } from "../Feature.interface"
import type { FeatureConfig } from "../Feature.interface"
import type { PolygonInstance } from "../../providers/Provider.interface"
import type { Coordinate } from "../../types"

export interface AreaData {
  id: string | number
  name?: string
  coordinates: Coordinate[]
  fillColor?: string
  strokeColor?: string
  fillOpacity?: number
  strokeWeight?: number
}

export interface AreasFeatureConfig extends FeatureConfig {
  areas?: AreaData[]
  onAreaClick?: (area: AreaData) => void
  defaultFillColor?: string
  defaultStrokeColor?: string
  defaultFillOpacity?: number
  defaultStrokeWeight?: number
}

export interface AreasFeatureState {
  areaCount: number
  visibleCount: number
}

export class AreasFeature extends BaseFeature<AreasFeatureConfig, AreasFeatureState> {
  readonly metadata = {
    name: "areas",
    version: "1.0.0",
    description: "Rendering and management of multiple geographic areas/polygons",
  }

  private polygons: Map<string | number, PolygonInstance> = new Map()

  protected async onInitialize(config: AreasFeatureConfig): Promise<void> {
    this.data = {
      areaCount: 0,
      visibleCount: 0,
    }

    logger.info(`[AreasFeature] Initializing with ${config.areas?.length || 0} areas`)
    if (config.areas?.length) {
      this.renderAreas(config.areas)
    }
  }

  protected onUpdate(config: AreasFeatureConfig): void {
    logger.debug(`[AreasFeature] Updating with ${config.areas?.length || 0} areas, state: ${this.state}`)
    if (config.areas) {
      this.renderAreas(config.areas)
    }
  }

  protected onEnable(): void {
    this.polygons.forEach(p => p.setVisible(true))
    this.updateState()
  }

  protected onDisable(): void {
    this.polygons.forEach(p => p.setVisible(false))
    this.updateState()
  }

  protected onDestroy(): void {
    this.clearAreas()
  }

  private renderAreas(areas: AreaData[]): void {
    if (!this.map || !this.provider?.createPolygon) return

    // Remove areas that are no longer present
    const newIds = new Set(areas.map(a => a.id))
    this.polygons.forEach((polygon, id) => {
      if (!newIds.has(id)) {
        polygon.remove()
        this.polygons.delete(id)
      }
    })

    // Add or update areas
    areas.forEach(area => {
      const existing = this.polygons.get(area.id)
      if (existing) {
        this.updateArea(existing, area)
      } else {
        this.createArea(area)
      }
    })

    this.updateState()
  }

  private createArea(area: AreaData): void {
    if (!this.map || !this.provider?.createPolygon || area.coordinates.length < 3) return

    try {
      const path = area.coordinates.map(c => ({ lat: c.latitude, lng: c.longitude }))
      const polygon = this.provider.createPolygon({
        paths: path,
        map: this.map,
        fillColor: area.fillColor || this.config?.defaultFillColor || "#3b82f6",
        fillOpacity: area.fillOpacity ?? this.config?.defaultFillOpacity ?? 0.2,
        strokeColor: area.strokeColor || this.config?.defaultStrokeColor || "#1e40af",
        strokeWeight: area.strokeWeight ?? this.config?.defaultStrokeWeight ?? 1,
        editable: false,
        draggable: false,
        visible: this.state === "enabled",
      })

      if (polygon) {
        if (this.config?.onAreaClick) {
          polygon.on("click", () => this.config?.onAreaClick?.(area))
        }
        this.polygons.set(area.id, polygon)
      }
    } catch (error) {
      logger.error(`[AreasFeature] Failed to create area ${area.id}:`, error)
    }
  }

  private updateArea(polygon: PolygonInstance, area: AreaData): void {
    const path = area.coordinates.map(c => ({ lat: c.latitude, lng: c.longitude }))
    polygon.setPath(path)
    polygon.setOptions({
      fillColor: area.fillColor || this.config?.defaultFillColor || "#3b82f6",
      fillOpacity: area.fillOpacity ?? this.config?.defaultFillOpacity ?? 0.2,
      strokeColor: area.strokeColor || this.config?.defaultStrokeColor || "#1e40af",
      strokeWeight: area.strokeWeight ?? this.config?.defaultStrokeWeight ?? 1,
      visible: this.state === "enabled",
    })
  }

  private clearAreas(): void {
    this.polygons.forEach(p => p.remove())
    this.polygons.clear()
    this.updateState()
  }

  private updateState(): void {
    const visibleCount = this.state === "enabled" ? this.polygons.size : 0
    this.data = {
      areaCount: this.polygons.size,
      visibleCount,
    }
  }
}
