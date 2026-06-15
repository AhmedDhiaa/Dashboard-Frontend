/**
 * Ticket System - Type Definitions
 *
 * Complete type system for the ticket management subsystem
 */

/* ============================================================================
 * USER TYPES
 * ========================================================================== */

export interface User {
  id: string
  tenantId: string | null
  userName: string
  name: string
  surname: string | null
  email: string
  emailConfirmed: boolean
  phoneNumber: string
  phoneNumberConfirmed: boolean
  isActive: boolean
  lockoutEnabled: boolean
  accessFailedCount: number
  lockoutEnd: string | null
  concurrencyStamp: string
  entityVersion: number
  lastPasswordChangeTime: string
  isDeleted: boolean
  deleterId: string | null
  deletionTime: string | null
  lastModificationTime: string | null
  lastModifierId: string | null
  creationTime: string
  creatorId: string | null
  extraProperties: Record<string, unknown>
}
