/**
 * Vehicle Park Types
 * Domain: Operations
 *
 * Type definitions for vehicle parking/storage locations
 */

import type { BaseEntity } from "@/shared/types/common"

export interface LocationPoint {
  longitude: number
  latitude: number
  angle: number
}

export interface Example extends BaseEntity {
  name: string
  foreignName: string
  address: string
  locationPoint: LocationPoint
  boundaries: LocationPoint[]
  note?: string
  isActive?: boolean
}
