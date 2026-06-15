/**
 * Entity Configuration Types and Registry
 *
 * This file exports only types and registry functions to avoid circular dependencies.
 * Import from this file when you only need types or registry access.
 */

// Re-export only types and registry functions
export type {
  EntityConfig,
  EntityConfigRegistry,
  EntityTranslations,
  EntityFeatures,
  SortConfig,
  FormFieldConfig,
  ConfigValidationResult,
} from "./types"

export {
  registerEntityConfig,
  getEntityConfig,
  hasEntityConfig,
  getRegisteredEntities,
  validateEntityConfig,
} from "./registry"
