/**
 * Marker Object Pool
 * Reuses marker instances to reduce memory allocations and improve performance
 * for frequently updated markers (e.g., vertex markers in polygon editing)
 */

import { logger } from "@/shared/logger"
import type { MarkerInstance } from "../providers/Provider.interface"

interface PooledMarker {
  marker: MarkerInstance
  inUse: boolean
}

/**
 * Marker Pool Manager
 * Maintains a pool of reusable marker instances
 */
export class MarkerPool {
  private pool: PooledMarker[] = []
  private maxSize: number
  private createMarker: () => MarkerInstance

  constructor(createMarkerFn: () => MarkerInstance, maxSize: number = 100) {
    this.createMarker = createMarkerFn
    this.maxSize = maxSize
    logger.debug(`[MarkerPool] Initialized with max size: ${maxSize}`)
  }

  /**
   * Acquire a marker from the pool (or create new if pool is empty)
   */
  acquire(): MarkerInstance | null {
    // Find an available marker in the pool
    const available = this.pool.find(item => !item.inUse)

    if (available) {
      available.inUse = true
      available.marker.setVisible(true)
      logger.debug(`[MarkerPool] Acquired marker from pool (${this.getStats().active}/${this.pool.length})`)
      return available.marker
    }

    // Pool is full - create new marker if below max size
    if (this.pool.length < this.maxSize) {
      try {
        const marker = this.createMarker()
        this.pool.push({ marker, inUse: true })
        logger.debug(`[MarkerPool] Created new marker (${this.pool.length}/${this.maxSize})`)
        return marker
      } catch (error) {
        logger.error("[MarkerPool] Failed to create marker:", error)
        return null
      }
    }

    logger.warn("[MarkerPool] Pool exhausted, cannot create more markers")
    return null
  }

  /**
   * Release a marker back to the pool
   */
  release(marker: MarkerInstance): void {
    const pooled = this.pool.find(item => item.marker === marker)

    if (pooled) {
      pooled.inUse = false
      // Hide marker when released to prevent visual artifacts
      marker.setVisible(false)
      logger.debug(`[MarkerPool] Released marker (${this.getStats().active}/${this.pool.length})`)
    } else {
      logger.warn("[MarkerPool] Attempted to release marker not in pool")
    }
  }

  /**
   * Release all markers back to the pool
   */
  releaseAll(): void {
    let count = 0
    this.pool.forEach(item => {
      if (item.inUse) {
        item.inUse = false
        item.marker.setVisible(false)
        count++
      }
    })
    logger.debug(`[MarkerPool] Released all markers (${count} released)`)
  }

  /**
   * Clear the entire pool and destroy all markers
   */
  clear(): void {
    logger.debug(`[MarkerPool] Clearing pool (${this.pool.length} markers)`)
    this.pool.forEach(item => {
      try {
        item.marker.remove()
      } catch (error) {
        logger.warn("[MarkerPool] Failed to remove marker:", error)
      }
    })
    this.pool = []
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; active: number; available: number } {
    const active = this.pool.filter(item => item.inUse).length
    return {
      total: this.pool.length,
      active,
      available: this.pool.length - active,
    }
  }

  /**
   * Optimize pool by removing excess inactive markers
   * Keeps at least minSize markers for future use
   */
  optimize(minSize: number = 10): void {
    const inactive = this.pool.filter(item => !item.inUse)
    const toRemove = Math.max(0, inactive.length - minSize)

    if (toRemove > 0) {
      logger.debug(`[MarkerPool] Optimizing: removing ${toRemove} inactive markers`)

      for (let i = 0; i < toRemove; i++) {
        const item = inactive[i]
        if (!item) continue

        try {
          item.marker.remove()
        } catch (error) {
          logger.warn("[MarkerPool] Failed to remove marker during optimization:", error)
        }

        const index = this.pool.indexOf(item)
        if (index > -1) {
          this.pool.splice(index, 1)
        }
      }
    }
  }
}
