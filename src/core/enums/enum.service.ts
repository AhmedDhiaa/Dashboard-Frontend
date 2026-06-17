/**
 * Enum Service
 *
 * Service layer for fetching enum values from the API
 */

import type { EnumPort } from "@/shared/ports/backend"
import { abpEnumPort } from "@/infra/api/adapters/abp/enum.adapter"
import type { EnumValue, EnumTypeName } from "./enum.types"

/**
 * Enum service with caching. The actual fetch lives behind an `EnumPort`
 * (default: the ABP adapter), so the backend can be swapped without touching
 * the cache layer, the provider, or the hooks.
 */
class EnumService {
  private cache: Map<string, EnumValue[]> = new Map()
  private pendingRequests: Map<string, Promise<EnumValue[]>> = new Map()

  constructor(private readonly backend: EnumPort = abpEnumPort) {}

  /**
   * Get enum values with caching
   */
  async getEnumValues(enumType: EnumTypeName): Promise<EnumValue[]> {
    // Return from cache if available
    if (this.cache.has(enumType)) {
      return this.cache.get(enumType)!
    }

    // Return pending request if already fetching
    if (this.pendingRequests.has(enumType)) {
      return this.pendingRequests.get(enumType)!
    }

    // Fetch and cache (via the backend port)
    const request = this.backend.getEnumValues(enumType)
    this.pendingRequests.set(enumType, request)

    try {
      const values = await request
      this.cache.set(enumType, values)
      return values
    } finally {
      this.pendingRequests.delete(enumType)
    }
  }

  /**
   * Get a specific enum value by ID
   */
  async getEnumValue(enumType: EnumTypeName, id: number): Promise<EnumValue | undefined> {
    const values = await this.getEnumValues(enumType)
    return values.find(v => v.id === id)
  }

  /**
   * Get enum display name by ID
   */
  async getEnumName(enumType: EnumTypeName, id: number, locale: "en" | "ar" = "en"): Promise<string> {
    const value = await this.getEnumValue(enumType, id)
    if (!value) return String(id)
    return locale === "ar" ? value.foreignName : value.name
  }

  /**
   * Clear cache for a specific enum type or all
   */
  clearCache(enumType?: EnumTypeName): void {
    if (enumType) {
      this.cache.delete(enumType)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Preload enum types
   */
  async preload(enumTypes: EnumTypeName[]): Promise<void> {
    await Promise.all(enumTypes.map(type => this.getEnumValues(type)))
  }
}

export const enumService = new EnumService()
