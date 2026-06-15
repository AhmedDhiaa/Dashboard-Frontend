/**
 * Feature Registry - Manages feature lifecycle and dependencies
 */

import { logger } from "@/shared/logger"
import type { MapInstance, MapProvider } from "../providers/Provider.interface"
import type { MapFeature, FeatureConfig, FeatureFactory, FeatureMetadata } from "./Feature.interface"

/**
 * Feature registration info
 */
interface FeatureRegistration {
  factory: FeatureFactory
  metadata: FeatureMetadata
  instance?: MapFeature<FeatureConfig, unknown>
}

/**
 * Feature Registry - Singleton
 */
export class FeatureRegistry {
  private features: Map<string, FeatureRegistration> = new Map()
  private activeFeatures: Map<string, MapFeature<FeatureConfig, unknown>> = new Map()

  /**
   * Register a feature
   */
  register(factory: FeatureFactory): void {
    const instance = factory()
    const metadata = instance.metadata

    if (this.features.has(metadata.name)) {
      logger.warn(`[FeatureRegistry] Feature ${metadata.name} already registered, skipping`)
      return
    }

    this.features.set(metadata.name, {
      factory,
      metadata,
    })

    logger.debug(`[FeatureRegistry] Registered feature: ${metadata.name}`)
  }

  /**
   * Register multiple features
   */
  registerMany(factories: FeatureFactory[]): void {
    factories.forEach(factory => this.register(factory))
  }

  /**
   * Unregister a feature
   */
  unregister(name: string): void {
    this.features.delete(name)
    logger.debug(`[FeatureRegistry] Unregistered feature: ${name}`)
  }

  /**
   * Check if a feature is registered
   */
  isRegistered(name: string): boolean {
    return this.features.has(name)
  }

  /**
   * Get all registered feature names
   */
  getRegisteredFeatures(): string[] {
    return Array.from(this.features.keys())
  }

  /**
   * Create and initialize a feature instance
   */
  async createFeature<TConfig extends FeatureConfig>(
    name: string,
    map: MapInstance,
    config: TConfig,
    provider?: MapProvider,
  ): Promise<MapFeature<TConfig, unknown>> {
    const registration = this.features.get(name)

    if (!registration) {
      throw new Error(`Feature ${name} not registered. Available: ${this.getRegisteredFeatures().join(", ")}`)
    }

    // Check dependencies
    if (registration.metadata.dependencies?.length) {
      for (const dep of registration.metadata.dependencies) {
        if (!this.activeFeatures.has(dep)) {
          throw new Error(`Feature ${name} requires ${dep} to be enabled first`)
        }
      }
    }

    // Create instance
    const instance = registration.factory() as MapFeature<TConfig, unknown>

    // Initialize with provider
    await instance.initialize(map, config, provider)

    // Track active feature
    this.activeFeatures.set(name, instance)

    logger.debug(`[FeatureRegistry] ✅ Created and initialized feature: ${name}`)

    return instance
  }

  /**
   * Get an active feature instance
   */
  getFeature<T extends MapFeature<FeatureConfig, unknown> = MapFeature<FeatureConfig, unknown>>(
    name: string,
  ): T | undefined {
    return this.activeFeatures.get(name) as T | undefined
  }

  /**
   * Destroy a feature instance
   */
  destroyFeature(name: string): void {
    const instance = this.activeFeatures.get(name)

    if (!instance) {
      logger.warn(`[FeatureRegistry] Feature ${name} not active`)
      return
    }

    instance.destroy()
    this.activeFeatures.delete(name)

    logger.debug(`[FeatureRegistry] Destroyed feature: ${name}`)
  }

  /**
   * Destroy all active features
   */
  destroyAll(): void {
    logger.debug(`[FeatureRegistry] Destroying ${this.activeFeatures.size} active features`)

    this.activeFeatures.forEach((instance, name) => {
      instance.destroy()
      logger.debug(`[FeatureRegistry] Destroyed: ${name}`)
    })

    this.activeFeatures.clear()
  }

  /**
   * Get all active feature names
   */
  getActiveFeatures(): string[] {
    return Array.from(this.activeFeatures.keys())
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.destroyAll()
    this.features.clear()
    logger.debug(`[FeatureRegistry] Cleared all feature registrations`)
  }
}

// Export singleton instance
export const featureRegistry = new FeatureRegistry()
