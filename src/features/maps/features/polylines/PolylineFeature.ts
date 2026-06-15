/**
 * Polyline Feature - Display and edit polylines (routes/paths)
 * Similar to BoundaryFeature but for lines instead of polygons
 */

import { logger } from "@/shared/logger"
import { BaseFeature } from "../Feature.interface"
import type { FeatureConfig } from "../Feature.interface"
import type { Coordinate } from "../../types"

export interface PolylineFeatureConfig extends FeatureConfig {
  /** Initial polyline coordinates */
  initialPolyline?: Coordinate[]

  /** Whether the polyline is editable */
  editable?: boolean

  /** Callback when polyline changes */
  onPolylineChange?: (polyline: Coordinate[]) => void

  /** Polyline stroke color (default: #f97316 - orange) */
  strokeColor?: string

  /** Stroke weight in pixels (default: 3) */
  strokeWeight?: number

  /** Stroke opacity 0-1 (default: 0.8) */
  strokeOpacity?: number

  /** Use dashed line style */
  dashed?: boolean

  /** Show direction arrows */
  showArrows?: boolean
}

export interface PolylineFeatureState {
  coordinates: Coordinate[]
  isEditing: boolean
}

export class PolylineFeature extends BaseFeature<PolylineFeatureConfig, PolylineFeatureState> {
  readonly metadata = {
    name: "polylines",
    version: "1.0.0",
    description: "Display and edit polylines on the map",
    dependencies: [],
  }

  private polyline: unknown = null
  private listeners: google.maps.MapsEventListener[] = []

  // Type-casting helper for strict mode compliance
  private get pl(): google.maps.Polyline {
    return this.polyline as google.maps.Polyline
  }

  protected async onInitialize(config: PolylineFeatureConfig): Promise<void> {
    logger.info("[PolylineFeature] Initializing...")

    this.data = {
      coordinates: config.initialPolyline || [],
      isEditing: false,
    }

    if (config.initialPolyline && config.initialPolyline.length > 0) {
      this.createPolyline(config.initialPolyline)
    }
  }

  protected onUpdate(config: PolylineFeatureConfig): void {
    logger.debug("[PolylineFeature] Updating...")

    // Update polyline if coordinates changed
    if (config.initialPolyline) {
      const currentPoints = this.data?.coordinates || []
      const newPoints = config.initialPolyline

      // Performance: Efficient comparison - check length first
      const hasChanged =
        currentPoints.length !== newPoints.length ||
        (newPoints.length > 0 &&
          (currentPoints[0]?.latitude !== newPoints[0]?.latitude ||
            currentPoints[0]?.longitude !== newPoints[0]?.longitude ||
            currentPoints[newPoints.length - 1]?.latitude !== newPoints[newPoints.length - 1]?.latitude ||
            currentPoints[newPoints.length - 1]?.longitude !== newPoints[newPoints.length - 1]?.longitude))

      if (hasChanged) {
        if (this.data) {
          this.data.coordinates = newPoints
        }

        if (this.polyline) {
          this.updatePolylinePath(newPoints)
        } else if (newPoints.length > 0) {
          this.createPolyline(newPoints)
        }
      }
    }

    // Update styling
    if (this.polyline && config) {
      this.updatePolylineStyle(config)
    }
  }

  protected onEnable(): void {
    logger.info("[PolylineFeature] Enabled")
    if (this.polyline) {
      this.pl.setMap(this.map?.getNativeInstance() as google.maps.Map | null)
    }
  }

  protected onDisable(): void {
    logger.info("[PolylineFeature] Disabled")
    if (this.polyline) {
      this.pl.setMap(null)
    }
  }

  protected onDestroy(): void {
    logger.info("[PolylineFeature] Destroying...")
    this.clearListeners()

    if (this.polyline) {
      this.pl.setMap(null)
      this.polyline = null
    }
  }

  private createPolyline(coordinates: Coordinate[]): void {
    if (!this.map || coordinates.length < 2) {
      logger.warn("[PolylineFeature] Cannot create polyline: insufficient points or no map")
      return
    }

    // Polylines here are implemented with the Google Maps API (google.maps.
    // Polyline / LatLng / event). Other providers (e.g. Leaflet) aren't
    // supported, so skip rather than throw "google is not defined".
    if (this.provider && this.provider.name !== "google") {
      logger.warn("[PolylineFeature] Polylines are only supported on the Google provider; skipping.")
      return
    }

    // Performance: Sampling for extremely large datasets (> 2000 points)
    let sampledPath = coordinates
    if (coordinates.length > 2000) {
      const step = Math.floor(coordinates.length / 1000)
      sampledPath = coordinates.filter((_, idx) => idx % step === 0 || idx === coordinates.length - 1)
      logger.info(`[PolylineFeature] Sampling enabled: ${coordinates.length} -> ${sampledPath.length} points`)
    }

    // Convert coordinates to Google Maps LatLng
    const path = sampledPath.map(
      coord => new google.maps.LatLng(coord.latitude, coord.longitude),
    ) as google.maps.LatLng[]

    const config = this.config || {}
    const strokeColor = config.strokeColor || "#f97316" // Orange
    const strokeWeight = config.strokeWeight ?? 3
    const strokeOpacity = config.strokeOpacity ?? 0.8

    // Create polyline options (typed as any for Google Maps API)
    const polylineOptions: google.maps.PolylineOptions = {
      path,
      strokeColor,
      strokeWeight,
      strokeOpacity,
      editable: config.editable ?? false,
      draggable: false,
      geodesic: true, // Follow earth's curvature
      map: this.map.getNativeInstance() as google.maps.Map,
    }

    // Add dashed style if requested
    if (config.dashed) {
      polylineOptions.strokeOpacity = 0 // Hide solid line
      polylineOptions.icons = [
        {
          icon: {
            path: "M 0,-1 0,1",
            strokeOpacity: strokeOpacity,
            strokeWeight: strokeWeight,
            scale: 3,
          },
          offset: "0",
          repeat: "20px",
        },
      ]
    }

    if (config.showArrows) {
      const google = window.google
      polylineOptions.icons = polylineOptions.icons || []
      polylineOptions.icons.push({
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          strokeColor,
          strokeOpacity,
          fillColor: strokeColor,
          fillOpacity: strokeOpacity,
          scale: 3,
        },
        offset: "100%",
        repeat: "100px",
      })
    }

    this.polyline = new google.maps.Polyline(polylineOptions)

    // Setup edit listeners if editable
    if (config.editable) {
      this.setupEditListeners()
    }

    logger.info(`[PolylineFeature] ✅ Polyline created with ${coordinates.length} points`)
  }

  private setupEditListeners(): void {
    if (!this.polyline) return

    const path = this.pl.getPath()

    // Listen for path changes (vertex drag, insert, remove)
    const google = window.google
    const pathListener = google.maps.event.addListener(path, "set_at", () => {
      this.handlePathChange()
    })

    const insertListener = google.maps.event.addListener(path, "insert_at", () => {
      this.handlePathChange()
    })

    const removeListener = google.maps.event.addListener(path, "remove_at", () => {
      this.handlePathChange()
    })

    this.listeners.push(pathListener, insertListener, removeListener)

    logger.debug("[PolylineFeature] Edit listeners attached")
  }

  private handlePathChange(): void {
    if (!this.polyline) return

    const path = this.pl.getPath()
    const coordinates: Coordinate[] = []

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      coordinates.push({
        longitude: point.lng(),
        latitude: point.lat(),
      })
    }

    if (this.data) {
      this.data.coordinates = coordinates
    }

    logger.debug(`[PolylineFeature] Path changed: ${coordinates.length} points`)

    // Notify callback
    this.config?.onPolylineChange?.(coordinates)
  }

  private updatePolylinePath(coordinates: Coordinate[]): void {
    if (!this.polyline || coordinates.length < 2) return

    const google = window.google

    // Performance: Sampling for extremely large datasets (> 2000 points)
    let sampledPath = coordinates
    if (coordinates.length > 2000) {
      const step = Math.floor(coordinates.length / 1000)
      sampledPath = coordinates.filter((_, idx) => idx % step === 0 || idx === coordinates.length - 1)
    }

    const path = sampledPath.map(
      coord => new google.maps.LatLng(coord.latitude, coord.longitude),
    ) as google.maps.LatLng[]

    this.pl.setPath(path)
    logger.debug(`[PolylineFeature] Path updated: ${coordinates.length} (sampled: ${sampledPath.length}) points`)
  }

  private updatePolylineStyle(config: PolylineFeatureConfig): void {
    if (!this.polyline) return

    const options: google.maps.PolylineOptions = {}

    if (config.strokeColor) options.strokeColor = config.strokeColor
    if (config.strokeWeight !== undefined) options.strokeWeight = config.strokeWeight
    if (config.strokeOpacity !== undefined) options.strokeOpacity = config.strokeOpacity
    if (config.editable !== undefined) options.editable = config.editable

    this.pl.setOptions(options)

    logger.debug("[PolylineFeature] Style updated")
  }

  private clearListeners(): void {
    this.listeners.forEach(listener => {
      const google = window.google
      if (google?.maps?.event) {
        google.maps.event.removeListener(listener)
      }
    })
    this.listeners = []
  }

  /**
   * Public API: Clear the polyline
   */
  public clearPolyline(): void {
    if (this.polyline) {
      this.pl.setMap(null)
      this.polyline = null
      if (this.data) {
        this.data.coordinates = []
      }
      this.clearListeners()

      logger.info("[PolylineFeature] Polyline cleared")

      // Notify callback with empty array
      this.config?.onPolylineChange?.([])
    }
  }

  /**
   * Public API: Get current coordinates
   */
  public getCoordinates(): Coordinate[] {
    return this.data?.coordinates || []
  }
}
