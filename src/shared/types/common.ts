/**
 * Common Type Definitions for Entity Relations
 *
 * These types replace `any` types in service files for better type safety
 */

// ============================================================================
// BASE ENTITY TYPES
// ============================================================================

/**
 * Base entity with audit fields
 */
export interface BaseEntity {
  id: string | number
  creationTime?: string
  creatorId?: string | null
  lastModificationTime?: string | null
  lastModifierId?: string | null
  isDeleted?: boolean
  deleterId?: string | null
  deletionTime?: string | null
  concurrencyStamp?: string
}

/**
 * Base entity with tenant support
 */
export interface TenantEntity extends BaseEntity {
  tenantId?: string | null
}

// ============================================================================
// USER & IDENTITY TYPES
// ============================================================================

/**
 * User reference (for creator, modifier, deleter fields)
 */
export interface UserReference {
  id: string
  userName?: string
  name?: string
  surname?: string
  email?: string
  phoneNumber?: string
}

/**
 * Identity user (full user object)
 */
export interface IdentityUser extends UserReference {
  emailConfirmed?: boolean
  phoneNumberConfirmed?: boolean
  twoFactorEnabled?: boolean
  lockoutEnd?: string | null
  lockoutEnabled?: boolean
  accessFailedCount?: number
  roles?: string[]
  isActive?: boolean
}

// ============================================================================
// TENANT TYPE
// ============================================================================

/**
 * Tenant reference
 */
export interface TenantReference {
  id: string
  name: string
}

// ============================================================================
// CURRENCY TYPE
// ============================================================================

/**
 * Currency reference
 */
export interface CurrencyReference {
  id: string | number
  code: string
  name: string
  foreignName?: string
  symbol?: string
}
