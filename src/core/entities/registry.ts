/**
 * Entity Configuration Registry and Validation
 *
 * @strict @enterprise-grade
 * Runtime validation and config management
 */

import type { EntityConfig, EntityConfigRegistry, ConfigValidationResult } from "./types"
import { logger } from "@/shared/logger"
import { applyEntityOverride } from "./overrides/merge"
import type { EntityOverrideMap } from "./overrides/schema"

/**
 * Global entity configuration registry
 */
const ENTITY_CONFIGS: EntityConfigRegistry = {}

/**
 * Override map applied on top of every `getEntityConfig` lookup.
 *
 * Populated on the server from `messages/_overrides/entity-overrides.json`
 * (see `setEntityOverrideMap`) and re-hydrated on the client via the
 * `/api/admin/entity-overrides` endpoint. Empty until something loads it,
 * which means baseline configs render verbatim during the brief window
 * between bundle parse and override hydration.
 */
let OVERRIDE_MAP: EntityOverrideMap = {}

export function setEntityOverrideMap(map: EntityOverrideMap): void {
  OVERRIDE_MAP = map ?? {}
}

/**
 * Lazy loaders registry - stores async functions returning configs
 */
const LAZY_LOADERS: Record<string, () => Promise<{ default?: unknown; [key: string]: unknown }>> = {}

/**
 * Registry state tracking
 */
const IN_FLIGHT_LOADS = new Map<string, Promise<void>>()

/**
 * Register an entity configuration
 */
export function registerEntityConfig<TEntity = unknown, TFormValues = unknown>(
  config: EntityConfig<TEntity, TFormValues>,
): void {
  const validation = validateEntityConfig(config)

  if (!validation.valid) {
    const errors = validation.errors.join("\n  - ")
    throw new Error(`[EntityConfig] Invalid configuration for "${config.entityName}":\n  - ${errors}`)
  }

  if (validation.warnings.length > 0) {
    logger.warn(`[EntityConfig] Warnings for "${config.entityName}":`, validation.warnings)
  }

  ENTITY_CONFIGS[config.entityName] = config
}

/**
 * All entity names known to the registry — both already-loaded configs
 * and pending lazy loaders. Use this when you need to enumerate every
 * entity the system can ever instantiate (e.g. the admin override panel
 * iterating to call `ensureEntityConfig` on each).
 */
export function getKnownEntityNames(): string[] {
  const merged = new Set<string>([...Object.keys(ENTITY_CONFIGS), ...Object.keys(LAZY_LOADERS)])
  return [...merged].sort()
}

/**
 * Register a lazy loader for an entity
 */
export function registerLazyLoader(
  entityName: string,
  loader: () => Promise<{ default?: unknown; [key: string]: unknown }>,
): void {
  if (entityName in LAZY_LOADERS) {
    throw new Error(`[EntityConfig] Duplicate lazy loader registration for "${entityName}".`)
  }
  LAZY_LOADERS[entityName] = loader
}

/**
 * Ensure an entity configuration is loaded and registered
 * returns a promise that resolves when the config is ready
 */
export async function ensureEntityConfig(entityName: string): Promise<void> {
  // 1. Already registered?
  if (hasEntityConfig(entityName)) return

  // 2. Check if already loading
  if (IN_FLIGHT_LOADS.has(entityName)) {
    return IN_FLIGHT_LOADS.get(entityName)
  }

  // 3. Find loader
  const loader = LAZY_LOADERS[entityName]
  if (!loader) {
    // If no loader, we can't do anything lazy - expect it to be registered statically or error later
    return
  }

  // 4. Trigger loader and track it
  const loadPromise = (async () => {
    try {
      const configModule = await loader()
      const config =
        configModule.default ||
        (configModule as Record<string, unknown>)[`${entityName}Config`] ||
        Object.values(configModule as Record<string, unknown>)[0]

      if (config && typeof config === "object" && "entityName" in config) {
        registerEntityConfig(config as EntityConfig<unknown, unknown>)
      } else {
        throw new Error(`[EntityConfig] Loader for "${entityName}" returned invalid or empty config`)
      }
    } catch (error) {
      logger.error(`[EntityConfig] Failed to lazy-load configuration for "${entityName}"`, error)
      throw error
    } finally {
      IN_FLIGHT_LOADS.delete(entityName)
    }
  })()

  IN_FLIGHT_LOADS.set(entityName, loadPromise)
  return loadPromise
}

/**
 * Get entity configuration by name. Applies any admin override on top of
 * the registered baseline before returning, so call sites always see the
 * effective config without having to know about the override layer.
 */
export function getEntityConfig<TEntity = unknown, TFormValues = unknown>(
  entityName: string,
): EntityConfig<TEntity, TFormValues> {
  const config = ENTITY_CONFIGS[entityName]

  if (!config) {
    throw new Error(
      `[EntityConfig] No configuration found for entity "${entityName}". ` +
        `Available entities: ${Object.keys(ENTITY_CONFIGS).join(", ")}`,
    )
  }

  const override = OVERRIDE_MAP[entityName]
  const effective = override ? applyEntityOverride(config, override) : config
  return effective as EntityConfig<TEntity, TFormValues>
}

/**
 * Check if entity has configuration
 */
export function hasEntityConfig(entityName: string): boolean {
  return entityName in ENTITY_CONFIGS
}

/**
 * Get all registered entity names
 */
export function getRegisteredEntities(): string[] {
  return Object.keys(ENTITY_CONFIGS)
}

/**
 * Individual validation functions - Strategy Pattern
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConfigValidator = (config: EntityConfig<any, any>, errors: string[], warnings: string[]) => void

const validateEntityName: ConfigValidator = (config, errors) => {
  if (!config.entityName) {
    errors.push("entityName is required")
  } else if (!/^[a-z][a-z0-9-]*$/.test(config.entityName)) {
    errors.push("entityName must be lowercase with hyphens only")
  }
}

const validateSingularName: ConfigValidator = (config, errors) => {
  if (!config.singularName) {
    errors.push("singularName is required")
  }
}

const validatePluralName: ConfigValidator = (config, errors) => {
  if (!config.pluralName) {
    errors.push("pluralName is required")
  }
}

const validateIcon: ConfigValidator = (config, errors) => {
  if (!config.icon) {
    errors.push("icon is required")
  }
}

const validateService: ConfigValidator = (config, errors) => {
  if (!config.service) {
    errors.push("service is required")
  }
}

const validateListColumns: ConfigValidator = (config, errors) => {
  if (!config.listColumns || config.listColumns.length === 0) {
    errors.push("listColumns must have at least one column")
  }
}

const validateDetailSections: ConfigValidator = (config, errors) => {
  if (!config.detailSections || config.detailSections.length === 0) {
    errors.push("detailSections must have at least one section")
  }
}

const validateFormFields: ConfigValidator = (config, _errors, warnings) => {
  if (!config.formFields || Object.keys(config.formFields).length === 0) {
    warnings.push("formFields is empty - form may not render correctly")
  }
}

const validateFormFieldOrder: ConfigValidator = (config, _errors, warnings) => {
  if (!config.formFieldOrder || config.formFieldOrder.length === 0) {
    warnings.push("formFieldOrder is empty - field order may be unpredictable")
  }
}

const validateSchemas: ConfigValidator = (config, errors) => {
  if (!config.createSchema) {
    errors.push("createSchema is required")
  }
  if (!config.updateSchema) {
    errors.push("updateSchema is required")
  }
}

const validateDefaultFormValues: ConfigValidator = (config, errors) => {
  if (!config.defaultFormValues) {
    errors.push("defaultFormValues is required")
  }
}

const validateTranslations: ConfigValidator = (config, errors) => {
  if (!config.translations) {
    errors.push("translations is required")
    return
  }

  const requiredTranslations = [
    "listTitle",
    "listDescription",
    "detailTitle",
    "createTitle",
    "editTitle",
    "searchPlaceholder",
  ]

  for (const key of requiredTranslations) {
    if (!config.translations[key as keyof typeof config.translations]) {
      errors.push(`translations.${key} is required`)
    }
  }
}

const validateFieldOrderConsistency: ConfigValidator = (config, _errors, warnings) => {
  if (!config.formFieldOrder || !config.formFields) return

  const fieldKeys = Object.keys(config.formFields)
  const orderKeys = config.formFieldOrder

  // Check for fields in order that don't exist in formFields
  const missingFields = orderKeys.filter(key => !fieldKeys.includes(key))
  if (missingFields.length > 0) {
    warnings.push(`formFieldOrder contains fields not in formFields: ${missingFields.join(", ")}`)
  }

  // Check for fields in formFields that aren't in order
  const unorderedFields = fieldKeys.filter(key => !orderKeys.includes(key))
  if (unorderedFields.length > 0) {
    warnings.push(`formFields contains fields not in formFieldOrder: ${unorderedFields.join(", ")}`)
  }
}

/**
 * Validator registry - ordered list of validation checks
 */
const validators: ConfigValidator[] = [
  validateEntityName,
  validateSingularName,
  validatePluralName,
  validateIcon,
  validateService,
  validateListColumns,
  validateDetailSections,
  validateFormFields,
  validateFormFieldOrder,
  validateSchemas,
  validateDefaultFormValues,
  validateTranslations,
  validateFieldOrderConsistency,
]

/**
 * Validate entity configuration - now using Strategy Pattern
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateEntityConfig(config: EntityConfig<any, any>): ConfigValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Run all validators
  for (const validator of validators) {
    validator(config, errors, warnings)
  }

  return {
    valid: errors.length === 0,
    entityName: config.entityName || "unknown",
    errors,
    warnings,
  }
}
