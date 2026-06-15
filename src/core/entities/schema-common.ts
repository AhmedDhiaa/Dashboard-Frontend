/**
 * Common Schema Fragments
 * Reusable validation patterns to eliminate duplication across entity schemas
 */

import { z } from "zod"

/**
 * Standard field schemas used across multiple entities
 */
export const commonFields = {
  /**
   * Code field - uppercase alphanumeric, 1-10 characters
   * Used by: Brand, Category, JobTitle, Unit, Currency, Country, City, Area, etc.
   */
  code: (required = true) => {
    const schema = z
      .string()
      .min(1, "Code is required")
      .max(10, "Code must be 10 characters or less")
      .regex(/^[A-Z0-9]+$/, "Code must be uppercase alphanumeric")
    return required ? schema : schema.optional()
  },

  /**
   * Name field - English name, 1-100 characters
   * Used by: All entities
   */
  name: (required = true) => {
    const schema = z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less")
    return required ? schema : schema.optional()
  },

  /**
   * Foreign name field - typically Arabic, 1-100 characters
   * Used by: All entities
   */
  foreignName: (required = true) => {
    const schema = z.string().min(1, "Foreign name is required").max(100, "Foreign name must be 100 characters or less")
    return required ? schema : schema.optional()
  },

  /**
   * Note field - optional long text, max 500 characters
   * Used by: Most entities
   */
  note: () => {
    return z.string().max(500, "Note must be 500 characters or less").optional()
  },

  /**
   * Concurrency stamp - required for updates
   * Used by: All entities (for optimistic concurrency control)
   */
  concurrencyStamp: () => {
    return z.string()
  },

  /**
   * Entity ID field - required for updates/relations
   */
  id: (type: "number" | "string" = "number") => {
    return type === "number" ? z.number().int().positive() : z.string().min(1)
  },

  /**
   * Parent ID field - for hierarchical entities
   * Used by: Category, etc.
   */
  parentId: () => {
    return z.number().int().positive().optional().nullable()
  },

  /**
   * Order number field - for ordering/sorting
   * Used by: Category, etc.
   */
  orderNo: () => {
    return z.number().int().positive().optional().nullable()
  },

  /**
   * Boolean flag field
   */
  boolean: (defaultValue: boolean = false) => {
    return z.boolean().default(defaultValue)
  },

  /**
   * Email field
   */
  email: (required = true) => {
    const schema = z.string().email("Invalid email address")
    return required ? schema : schema.optional()
  },

  /**
   * Phone number field
   */
  phone: (required = false) => {
    const schema = z.string().regex(/^\+?[0-9\s\-()]+$/, "Invalid phone number")
    return required ? schema : schema.optional()
  },

  /**
   * URL field
   */
  url: (required = false) => {
    const schema = z.string().url("Invalid URL")
    return required ? schema : schema.optional()
  },

  /**
   * Boundaries field - array of coordinates
   * Used by: City, Area
   */
  boundaries: () => {
    return z
      .array(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          sequence: z.number().optional(),
        }),
      )
      .optional()
  },
}

// ============================================================================
// HELPER FUNCTIONS (for backward compatibility with existing schema files)
// ============================================================================

/**
 * Get optional string field
 */
export const getOptionalString = (maxLength: number = 100) => {
  return z.string().max(maxLength).optional()
}

/**
 * Get name field (English)
 */
export const getNameField = (required: boolean = true) => {
  return commonFields.name(required)
}

/**
 * Get boolean field
 */
export const getBooleanField = (defaultValue: boolean = false) => {
  return commonFields.boolean(defaultValue)
}

/**
 * Get email field
 */
export const getEmailField = (required: boolean = true) => {
  return commonFields.email(required)
}
