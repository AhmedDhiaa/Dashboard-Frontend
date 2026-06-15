/**
 * Type definitions for schema functions
 */

/**
 * Translation function type from next-intl
 * Used in schema validation messages
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TFunction = (key: string, values?: Record<string, any>) => string
