/**
 * Marker Feature - Manages map markers with performance optimizations
 */

import { logger } from "@/shared/logger"
import { BaseFeature } from "../Feature.interface"
import type { FeatureConfig } from "../Feature.interface"
import type { MarkerInstance, ClustererInstance } from "../../providers/Provider.interface"
import type { MapMarker } from "../../types"

export interface MarkerFeatureConfig extends FeatureConfig {
  markers?: MapMarker[]
  onMarkerClick?: (marker: MapMarker) => void
  onMarkerDragEnd?: (marker: MapMarker, position: { lat: number; lng: number }) => void
  fitBounds?: boolean // Auto-fit bounds to show all markers
  clusteringEnabled?: boolean
  clusterOptions?: {
    minimumClusterSize?: number
    maxZoom?: number
    gridSize?: number
    [key: string]: unknown
  }
}

export interface MarkerFeatureState {
  markerCount: number
  visibleCount: number
}

export class MarkerFeature extends BaseFeature<MarkerFeatureConfig, MarkerFeatureState> {
  readonly metadata = {
    name: "markers",
    version: "1.0.0",
    description: "Marker rendering and management",
  }

  private markerInstances: Map<string, MarkerInstance> = new Map()
  private markerPool: MarkerInstance[] = []
  private clusterer: ClustererInstance | null = null

  protected async onInitialize(config: MarkerFeatureConfig): Promise<void> {
    this.data = {
      markerCount: 0,
      visibleCount: 0,
    }

    if (config.markers?.length) {
      await this.renderMarkers(config.markers)
    }

    // Initialize clusterer if clustering is enabled
    if (config.clusteringEnabled) {
      this.initClusterer(config)
    }
  }

  protected async onUpdate(config: MarkerFeatureConfig): Promise<void> {
    // Check if clustering state changed
    const clusteringToggled = this.config?.clusteringEnabled !== config.clusteringEnabled

    if (clusteringToggled) {
      if (config.clusteringEnabled) {
        this.initClusterer(config)
      } else {
        this.destroyClusterer()
      }
    }

    if (config.markers) {
      await this.renderMarkers(config.markers)
    }

    // Update fitBounds if requested
    if (config.fitBounds && config.markers?.length) {
      this.fitBoundsToMarkers(config.markers)
    }
  }

  protected onEnable(): void {
    this.markerInstances.forEach(marker => marker.setVisible(true))
    this.updateState()
  }

  protected onDisable(): void {
    this.markerInstances.forEach(marker => marker.setVisible(false))
    this.updateState()
  }

  protected onDestroy(): void {
    this.destroyClusterer()
    this.clearMarkers()
    this.markerPool.forEach(marker => marker.remove())
    this.markerPool = []
  }

  private initClusterer(config: MarkerFeatureConfig): void {
    if (!this.map || !this.provider) return

    this.destroyClusterer()

    this.clusterer = this.provider.createClusterer({
      map: this.map,
      markers: Array.from(this.markerInstances.values()),
      ...config.clusterOptions,
    })
  }

  private destroyClusterer(): void {
    if (this.clusterer) {
      this.clusterer.clearMarkers()
      this.clusterer = null
    }
  }

  private async renderMarkers(markers: MapMarker[]): Promise<void> {
    if (!this.map) return

    // Remove markers not in new list
    const newIds = new Set(markers.map(m => m.id))
    this.markerInstances.forEach((_marker, id) => {
      if (!newIds.has(id)) {
        this.removeMarker(id)
      }
    })

    // Add or update markers
    const addedMarkers: MarkerInstance[] = []

    markers.forEach(markerConfig => {
      const existing = this.markerInstances.get(markerConfig.id)

      if (existing) {
        // Update existing marker
        this.updateMarker(existing, markerConfig)
      } else {
        // Create new marker
        const marker = this.createMarker(markerConfig)
        if (marker) addedMarkers.push(marker)
      }
    })

    if (this.clusterer && addedMarkers.length > 0) {
      this.clusterer.addMarkers(addedMarkers)
    }

    this.updateState()
  }

  private createMarker(config: MapMarker): MarkerInstance | null {
    if (!this.map || !this.config) return null

    if (!this.provider) {
      logger.error(`[MarkerFeature] Provider not available, cannot create marker ${config.id}`)
      return null
    }

    // Validate position has valid lat/lng numbers
    if (
      !config.position ||
      typeof config.position.lat !== "number" ||
      typeof config.position.lng !== "number" ||
      isNaN(config.position.lat) ||
      isNaN(config.position.lng)
    ) {
      logger.error(`[MarkerFeature] Invalid position for marker ${config.id}:`, config.position)
      return null
    }

    try {
      const marker = this.provider.createMarker({
        position: config.position,
        map: this.map,
        title: config.title,
        icon: config.icon,
        draggable: config.draggable,
        visible: config.visible !== false,
      })

      // Add click listener
      if (config.onClick || this.config.onMarkerClick) {
        marker.on("click", () => {
          config.onClick?.()
          this.config?.onMarkerClick?.(config)
        })
      }

      // Add drag listener
      if (config.draggable && (config.onDragEnd || this.config.onMarkerDragEnd)) {
        marker.on("dragend", () => {
          const position = marker.getPosition()
          config.onDragEnd?.(position)
          this.config?.onMarkerDragEnd?.(config, position)
        })
      }

      this.markerInstances.set(config.id, marker)

      return marker
    } catch (error) {
      logger.error(`[MarkerFeature] Failed to create marker ${config.id}:`, error)
      return null
    }
  }

  private updateMarker(marker: MarkerInstance, config: MapMarker): void {
    // Validate position before updating
    if (
      config.position &&
      typeof config.position.lat === "number" &&
      typeof config.position.lng === "number" &&
      !isNaN(config.position.lat) &&
      !isNaN(config.position.lng)
    ) {
      marker.setPosition(config.position)
    } else {
      logger.warn(
        `[MarkerFeature] Skipping position update for marker ${config.id} due to invalid coordinates:`,
        config.position,
      )
    }

    // Only update icon if it's explicitly provided in the config. Route through
    // the provider's MarkerInstance.setIcon so the conversion is provider-aware
    // (Google → toGoogleIcon, Leaflet → toLeafletIcon) instead of building a
    // google.maps icon here, which crashes under non-Google providers.
    if (config.icon) {
      marker.setIcon(config.icon)

      // Apply rotation if provided
      if (typeof config.icon === "object" && typeof config.icon.rotation === "number") {
        marker.setRotation(config.icon.rotation)
      }
    }

    marker.setVisible(config.visible !== false)
    marker.setDraggable(config.draggable || false)
  }

  private removeMarker(id: string): void {
    const marker = this.markerInstances.get(id)
    if (marker) {
      if (this.clusterer) {
        this.clusterer.removeMarker(marker)
      }
      marker.remove()
      this.markerInstances.delete(id)
    }
  }

  private clearMarkers(): void {
    this.markerInstances.forEach(marker => marker.remove())
    this.markerInstances.clear()
    this.updateState()
  }

  private updateState(): void {
    const visibleCount = Array.from(this.markerInstances.values()).filter(m => m.isVisible()).length

    this.data = {
      markerCount: this.markerInstances.size,
      visibleCount,
    }
  }

  private fitBoundsToMarkers(markers: MapMarker[]): void {
    if (!this.map || markers.length === 0) return

    try {
      if (this.map) {
        const bounds = {
          north: Math.max(...markers.map(m => m.position.lat)),
          south: Math.min(...markers.map(m => m.position.lat)),
          east: Math.max(...markers.map(m => m.position.lng)),
          west: Math.min(...markers.map(m => m.position.lng)),
        }

        this.map.fitBounds(bounds, { padding: 50 })
      }
    } catch (error) {
      logger.error("[MarkerFeature] Failed to fit bounds:", error)
    }
  }

  // Public API
  public getMarker(id: string): MarkerInstance | undefined {
    return this.markerInstances.get(id)
  }

  public getAllMarkers(): MarkerInstance[] {
    return Array.from(this.markerInstances.values())
  }
}
