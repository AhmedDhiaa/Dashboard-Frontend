/**
 * Provider Factory - Creates and manages map providers
 */

import { logger } from "@/shared/logger"
import type { MapProvider, ProviderFactory as IProviderFactory } from "./Provider.interface"
import { GoogleMapsProvider } from "./GoogleMapsProvider"
import { LeafletMapProvider } from "./leaflet/LeafletMapProvider"

/**
 * Provider factory implementation
 */
class ProviderFactoryImpl implements IProviderFactory {
  private providers: Map<string, MapProvider> = new Map()

  /**
   * Create or retrieve a provider instance
   */
  async createProvider(name: string, apiKey: string): Promise<MapProvider> {
    // Return cached provider if exists
    const existing = this.providers.get(name)
    if (existing && existing.isInitialized()) {
      logger.debug(`[ProviderFactory] Returning cached ${name} provider`)
      return existing
    }

    logger.info(`[ProviderFactory] Creating ${name} provider`)

    let provider: MapProvider

    switch (name.toLowerCase()) {
      case "google":
        provider = new GoogleMapsProvider()
        break

      case "leaflet":
        provider = new LeafletMapProvider()
        break

      case "mapbox":
        throw new Error("Mapbox provider not yet implemented")

      default:
        throw new Error(`Unknown provider: ${name}. Available: ${this.getAvailableProviders().join(", ")}`)
    }

    // Initialize the provider
    await provider.initialize(apiKey)

    // Cache it
    this.providers.set(name, provider)

    return provider
  }

  /**
   * Get list of available provider names
   */
  getAvailableProviders(): string[] {
    return ["google", "leaflet"] // 'mapbox' can be added later
  }

  /**
   * Clear all cached providers
   */
  clearCache(): void {
    this.providers.forEach(provider => provider.destroy())
    this.providers.clear()
  }

  /**
   * Get a cached provider if it exists
   */
  getCachedProvider(name: string): MapProvider | undefined {
    return this.providers.get(name)
  }
}

// Export singleton instance
export const ProviderFactory = new ProviderFactoryImpl()
