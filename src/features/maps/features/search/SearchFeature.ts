/**
 * Search Feature - Lazy-loaded search functionality for maps
 * Provides place search with caching and boundary extraction
 */

import type { BaseFeatureConfig } from "../types"
import type { SearchResult, SearchType } from "../../ui/SearchControl"
import { logger } from "@/shared/logger"

export interface SearchFeatureConfig extends BaseFeatureConfig {
  /** Types of search to enable */
  searchTypes?: SearchType[]

  /** Whether to extract boundaries */
  extractBoundaries?: boolean

  /** Show boundary preview on map */
  showBoundaryPreview?: boolean

  /** Cache search results */
  cacheResults?: boolean

  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number

  /** Initial visibility */
  initiallyVisible?: boolean
}

interface CachedResult {
  result: SearchResult
  timestamp: number
}

export class SearchFeature {
  public readonly metadata = {
    name: "search",
    version: "1.0.0",
    description: "Place search with caching and boundary extraction",
    dependencies: [],
  }

  private config: SearchFeatureConfig
  private isVisible: boolean = false
  private cache: Map<string, CachedResult> = new Map()

  constructor(_map: unknown, config: SearchFeatureConfig = {}) {
    this.config = {
      searchTypes: ["places"],
      extractBoundaries: true,
      showBoundaryPreview: true,
      cacheResults: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      initiallyVisible: false,
      enabled: true,
      ...config,
    }
    this.isVisible = this.config.initiallyVisible || false
  }

  async initialize(): Promise<void> {
    logger.info("[SearchFeature] Initialized")
  }

  isEnabled(): boolean {
    return this.config.enabled !== false
  }

  getState(): unknown {
    return {
      isVisible: this.isVisible,
      cacheSize: this.cache.size,
      config: this.config,
    }
  }

  update(config: Partial<SearchFeatureConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info("[SearchFeature] Configuration updated", this.config)
  }

  destroy(): void {
    this.cache.clear()
    logger.info("[SearchFeature] Destroyed")
  }

  // Public API methods

  /**
   * Show search control
   */
  show(): void {
    this.isVisible = true
    logger.info("[SearchFeature] Search control shown")
  }

  /**
   * Hide search control
   */
  hide(): void {
    this.isVisible = false
    logger.info("[SearchFeature] Search control hidden")
  }

  /**
   * Toggle search visibility
   */
  toggle(): void {
    this.isVisible = !this.isVisible
    logger.info(`[SearchFeature] Search control ${this.isVisible ? "shown" : "hidden"}`)
  }

  /**
   * Get cached result
   */
  getCachedResult(query: string): SearchResult | null {
    if (!this.config.cacheResults) return null

    const cached = this.cache.get(query.toLowerCase())
    if (!cached) return null

    const now = Date.now()
    const age = now - cached.timestamp

    if (age > (this.config.cacheTTL || 5 * 60 * 1000)) {
      this.cache.delete(query.toLowerCase())
      return null
    }

    logger.debug("[SearchFeature] Cache hit for query:", query)
    return cached.result
  }

  /**
   * Cache a search result
   */
  cacheResult(query: string, result: SearchResult): void {
    if (!this.config.cacheResults) return

    this.cache.set(query.toLowerCase(), {
      result,
      timestamp: Date.now(),
    })

    logger.debug("[SearchFeature] Cached result for query:", query)
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    logger.info("[SearchFeature] Cache cleared")
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }

  /**
   * Get visibility state
   */
  getVisibility(): boolean {
    return this.isVisible
  }

  /**
   * Get configuration
   */
  getConfig(): SearchFeatureConfig {
    return { ...this.config }
  }
}

// Factory function for feature registry
export function createSearchFeature(map: unknown, config: SearchFeatureConfig = {}): SearchFeature {
  return new SearchFeature(map, config)
}
