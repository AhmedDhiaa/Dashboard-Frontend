/**
 * Type Utilities
 * Reusable TypeScript utility types
 */

/**
 * Deep partial (makes all nested properties optional)
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

/**
 * Deep readonly (makes all nested properties readonly)
 */
export type DeepReadonly<T> = T extends object
  ? {
      readonly [P in keyof T]: DeepReadonly<T[P]>
    }
  : T
