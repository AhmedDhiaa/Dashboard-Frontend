/**
 * Enum Service
 *
 * Service layer for fetching enum values from the API
 */

import { apiClient } from "@/infra/api/client"
import { logger } from "@/shared/logger"
import type { EnumValue, EnumTypeName } from "./enum.types"

export async function fetchEnumValues(enumType: EnumTypeName): Promise<EnumValue[]> {
  try {
    const response = await apiClient.get<EnumValue[]>(`/api/app/enum/${enumType}`)
    return response.data
  } catch (error) {
    logger.error(`[EnumService] Failed to fetch enum: ${enumType}`, error)
    throw error
  }
}

/**
 * Enum service with caching
 */
class EnumService {
  private cache: Map<string, EnumValue[]> = new Map()
  private pendingRequests: Map<string, Promise<EnumValue[]>> = new Map()

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

    // Fetch and cache
    const request = fetchEnumValues(enumType)
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
