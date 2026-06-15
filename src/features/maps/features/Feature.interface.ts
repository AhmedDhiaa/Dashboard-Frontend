/**
 * Feature Interface - Contract for all map features
 *
 * Defines the lifecycle and behavior contract that all map features must implement.
 * Features are independent, composable modules that add functionality to the map.
 */

import type { MapInstance, MapProvider } from "../providers/Provider.interface"

/**
 * Feature lifecycle states
 */
export type FeatureState = "uninitialized" | "initialized" | "enabled" | "disabled" | "destroyed"

/**
 * Base feature configuration
 */
export interface FeatureConfig {
  enabled?: boolean
  [key: string]: unknown
}

/**
 * Feature metadata
 */
export interface FeatureMetadata {
  name: string
  version: string
  description?: string
  author?: string
  dependencies?: string[]
}

/**
 * Core feature interface - All features must implement this
 */
export interface MapFeature<TConfig extends FeatureConfig = FeatureConfig, TState = unknown> {
  /** Feature metadata */
  readonly metadata: FeatureMetadata

  /** Current feature state */
  getState(): FeatureState

  /** Get feature-specific state data */
  getData(): TState

  /** Get current feature configuration */
  getConfig(): TConfig

  // Lifecycle methods
  initialize(map: MapInstance, config: TConfig, provider?: MapProvider): void | Promise<void>
  update(config: Partial<TConfig>): void
  destroy(): void

  // Control methods
  enable(): void
  disable(): void
  isEnabled(): boolean

  // Observer system
  subscribe(callback: (data: TState, state: FeatureState) => void): () => void

  // Optional event handling
  onMapEvent?(event: string, data: unknown): void
}

/**
 * Feature constructor type
 */
export type FeatureConstructor<
  TFeature extends MapFeature<FeatureConfig, unknown> = MapFeature<FeatureConfig, unknown>,
> = new () => TFeature

/**
 * Feature factory function type
 */
export type FeatureFactory<TFeature extends MapFeature<FeatureConfig, unknown> = MapFeature<FeatureConfig, unknown>> =
  () => TFeature

/**
 * Base abstract feature class - Provides common functionality
 */
export abstract class BaseFeature<
  TConfig extends FeatureConfig = FeatureConfig,
  TState = unknown,
> implements MapFeature<TConfig, TState> {
  abstract readonly metadata: FeatureMetadata

  protected map: MapInstance | null = null
  protected provider: MapProvider | null = null
  protected config: TConfig | null = null
  protected state: FeatureState = "uninitialized"
  protected data: TState | null = null

  getState(): FeatureState {
    return this.state
  }

  getData(): TState {
    return this.data || ({} as TState)
  }

  getConfig(): TConfig {
    return this.config || ({} as TConfig)
  }

  async initialize(map: MapInstance, config: TConfig, provider?: MapProvider): Promise<void> {
    if (this.state !== "uninitialized") {
      throw new Error(`Feature ${this.metadata.name} already initialized`)
    }

    this.map = map
    this.provider = provider || null
    this.config = config

    await this.onInitialize(config)

    this.state = "initialized"

    if (config.enabled !== false) {
      this.enable()
    }
  }

  update(config: Partial<TConfig>): void {
    if (!this.map || !this.config) {
      throw new Error(`Feature ${this.metadata.name} not initialized`)
    }

    const wasEnabled = this.config.enabled !== false
    const nowEnabled = config.enabled !== false

    this.config = { ...this.config, ...config }
    this.onUpdate(this.config)

    // Automatically manage enabled state
    if (wasEnabled && !nowEnabled) {
      this.disable()
    } else if (!wasEnabled && nowEnabled) {
      this.enable()
    }
  }

  enable(): void {
    if (!this.map || !this.config) {
      throw new Error(`Feature ${this.metadata.name} not initialized`)
    }

    if (this.state === "enabled") return

    this.onEnable()
    this.state = "enabled"
  }

  disable(): void {
    if (this.state !== "enabled") return

    this.onDisable()
    this.state = "disabled"
    this.notifyListeners()
  }

  isEnabled(): boolean {
    return this.state === "enabled"
  }

  destroy(): void {
    if (this.state === "destroyed") return

    if (this.state === "enabled") {
      this.disable()
    }

    this.onDestroy()

    this.map = null
    this.config = null
    this.data = null
    this.state = "destroyed"
    this.stateChangeListeners.clear()
  }

  // Listener system
  private stateChangeListeners: Set<(data: TState, state: FeatureState) => void> = new Set()

  public subscribe(callback: (data: TState, state: FeatureState) => void): () => void {
    this.stateChangeListeners.add(callback)
    // Immediate call with current state
    callback(this.getData(), this.getState())
    return () => this.stateChangeListeners.delete(callback)
  }

  protected notifyListeners(): void {
    const currentState = this.getState()
    const currentData = this.getData()
    this.stateChangeListeners.forEach(callback => callback(currentData, currentState))
  }

  // Protected methods for subclasses to override
  protected abstract onInitialize(config: TConfig): void | Promise<void>
  protected abstract onUpdate(config: TConfig): void
  protected abstract onEnable(): void
  protected abstract onDisable(): void
  protected abstract onDestroy(): void
}

/**
 * Helper to create a feature factory
 */
export function createFeatureFactory<TFeature extends MapFeature<FeatureConfig, unknown>>(
  FeatureClass: FeatureConstructor<TFeature>,
): FeatureFactory<TFeature> {
  return () => new FeatureClass()
}
