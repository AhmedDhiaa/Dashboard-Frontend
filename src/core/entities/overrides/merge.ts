/**
 * Merge a JSON override on top of a registered EntityConfig.
 *
 * Pure function — does not mutate the input config. Returns a shallow
 * copy with the override-allowed fields replaced. Form-field overrides
 * are merged per-field so admins can tweak `required` on one field
 * without redeclaring the whole formFields map.
 *
 * Anything not in the override schema is left as-is; the schema is the
 * security boundary, this module just applies the result.
 */

import type { EntityConfig, FormFieldConfig } from "../types"
import type { EntityOverride, FormFieldOverride } from "./schema"

function mergeFormField(base: FormFieldConfig, patch: FormFieldOverride): FormFieldConfig {
  return {
    ...base,
    ...(patch.label !== undefined && { label: patch.label }),
    ...(patch.description !== undefined && { description: patch.description }),
    ...(patch.placeholder !== undefined && { placeholder: patch.placeholder }),
    ...(patch.required !== undefined && { required: patch.required }),
    ...(patch.disabled !== undefined && { disabled: patch.disabled }),
    ...(patch.hidden !== undefined && { hidden: patch.hidden }),
    ...(patch.rows !== undefined && { rows: patch.rows }),
    ...(patch.colSpan !== undefined && { colSpan: patch.colSpan }),
    ...(patch.min !== undefined && { min: patch.min }),
    ...(patch.max !== undefined && { max: patch.max }),
    ...(patch.step !== undefined && { step: patch.step }),
  }
}

export function applyEntityOverride<TEntity, TFormValues>(
  config: EntityConfig<TEntity, TFormValues>,
  override: EntityOverride | undefined,
): EntityConfig<TEntity, TFormValues> {
  if (!override) return config

  const next: EntityConfig<TEntity, TFormValues> = { ...config }

  if (override.singularName !== undefined) next.singularName = override.singularName
  if (override.pluralName !== undefined) next.pluralName = override.pluralName
  if (override.defaultPageSize !== undefined) next.defaultPageSize = override.defaultPageSize
  if (override.defaultSort !== undefined) {
    // The override schema constrains `field` to a string; cast to the
    // generic key/string union the type expects.
    next.defaultSort = override.defaultSort as typeof next.defaultSort
  }
  if (override.features !== undefined) {
    next.features = { ...config.features, ...override.features }
  }
  if (override.permissionKey !== undefined) next.permissionKey = override.permissionKey
  if (override.basePath !== undefined) next.basePath = override.basePath
  if (override.formFieldOrder !== undefined) next.formFieldOrder = override.formFieldOrder

  if (override.formFields !== undefined) {
    const mergedFields: Record<string, FormFieldConfig> = { ...config.formFields }
    for (const [fieldName, patch] of Object.entries(override.formFields)) {
      const base = mergedFields[fieldName]
      if (!base) continue // ignore overrides for fields that no longer exist
      mergedFields[fieldName] = mergeFormField(base, patch)
    }
    next.formFields = mergedFields
  }

  return next
}
