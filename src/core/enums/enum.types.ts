/**
 * Enum Types and Interfaces
 *
 * Centralized type definitions for the enum system
 */

/**
 * Single enum value from the API
 */
export interface EnumValue {
  id: number
  name: string
  foreignName: string
  code?: string
  localization?: {
    name: string
    value: string
  }
}

/**
 * Available enum types in the system
 */
export type EnumTypeName =
  | "entity-type"
  | "user-one-time-password-type"
  | "amount-type"
  | "status"
  | "notification-type"
  | "notification-status"
  | "settlement-method"
  | "business-partner-type"
  | "entity-change-type"
  | "extra-charge-type"
  | "ticket-status"

/**
 * Enum cache structure
 */
export interface EnumCache {
  [enumType: string]: EnumValue[]
}

/**
 * Enum context state
 */
export interface EnumContextState {
  cache: EnumCache
  loading: Record<string, boolean>
  errors: Record<string, Error | null>
  loadEnum: (enumType: EnumTypeName) => void
  getEnumValues: (enumType: EnumTypeName) => EnumValue[]
  getEnumValue: (enumType: EnumTypeName, id: number) => EnumValue | undefined
  getEnumName: (enumType: EnumTypeName, id: number, locale?: "en" | "ar") => string
  isLoading: (enumType: EnumTypeName) => boolean
  getError: (enumType: EnumTypeName) => Error | null
}
