/**
 * Common entity type definitions.
 *
 * Shared audit/reference shapes that replace `any` in service files for better
 * type safety. Keep this lean — add a type here only when it's used across more
 * than one domain; domain-specific shapes belong with their domain.
 */

/** Base entity with ABP audit fields. */
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
