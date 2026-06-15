/**
 * Page Builder → SchemaFormRenderer adapter helpers.
 *
 * Translates a `FieldSchema[]` (Page Builder's 28-value field-type vocabulary)
 * into the three artefacts a `SchemaFormRenderer` + `react-hook-form` pair
 * needs at runtime:
 *
 *   - `buildZodSchema(fields)`     → Zod validator used as the RHF resolver.
 *   - `buildFieldConfig(fields)`   → `Record<name, FormFieldConfig>` consumed
 *                                    by the renderer to dispatch the right
 *                                    `<TextField>` / `<EntityAutocompleteField>` / …
 *   - `buildDefaultValues(fields)` → seed for `useForm({ defaultValues })`.
 *
 * Hidden fields are excluded from the schema (they cannot be edited, so
 * required-validation against them would deadlock submission). They still
 * receive a default value so non-editable bound state survives a round-trip.
 *
 * Lives in `renderer/` rather than `registry/blocks/` because it is pure
 * data plumbing — no React, no JSX — and is unit-tested standalone.
 */

import { z, type ZodTypeAny } from "zod"
import type { DefaultValues } from "react-hook-form"
import type { FormFieldConfig } from "@/core/entities/types"
import type { FieldSchema, PageBuilderFieldType } from "../schema/field-schema"

// ─── Page-Builder field type → FormFieldConfig.type adapter ─────────────────
//
// `FormFieldConfig.type` (the legacy entity-config field type) carries 13
// values, while the Page Builder schema admits 29. We collapse the broader
// set to the renderer-supported subset here. The renderer's FieldRenderer
// then dispatches on the resulting type.

const PB_TO_ENTITY_CONFIG_TYPE: Record<string, FormFieldConfig["type"]> = {
  text: "text",
  string: "text",
  textarea: "textarea",
  richtext: "textarea",
  json: "textarea",
  number: "number",
  currency: "number",
  percentage: "number",
  boolean: "boolean",
  switch: "boolean",
  date: "date",
  "date-range": "date",
  datetime: "datetime",
  time: "datetime",
  select: "select",
  "multi-select": "select",
  radio: "select",
  autocomplete: "autocomplete",
  "entity-autocomplete": "autocomplete",
  "api-autocomplete": "autocomplete",
  "multi-autocomplete": "autocomplete",
  file: "file",
  image: "file",
  "image-crop": "file",
  password: "password",
  email: "email",
  phone: "text",
  url: "text",
  enum: "enum",
  color: "custom",
  "map-location": "custom",
  custom: "custom",
}

export function mapFieldTypeToFormFieldType(type: PageBuilderFieldType): FormFieldConfig["type"] {
  return PB_TO_ENTITY_CONFIG_TYPE[type] ?? "text"
}

// ─── Per-field Zod construction ─────────────────────────────────────────────

function buildZodNumberForField(field: FieldSchema): z.ZodNumber {
  let n: z.ZodNumber = z.number()
  if (field.validation?.min !== undefined) n = n.min(field.validation.min)
  if (field.validation?.max !== undefined) n = n.max(field.validation.max)
  return n
}

function buildZodStringForField(field: FieldSchema): z.ZodString {
  let s: z.ZodString = z.string()
  if (field.validation?.minLength !== undefined) s = s.min(field.validation.minLength)
  if (field.validation?.maxLength !== undefined) s = s.max(field.validation.maxLength)
  if (field.validation?.pattern) {
    try {
      s = s.regex(new RegExp(field.validation.pattern))
    } catch {
      // Invalid regex falls through — the schema still validates, just
      // without the pattern constraint. Authoring UI surfaces this.
    }
  }
  return s
}

function buildZodForField(field: FieldSchema): ZodTypeAny {
  let base: ZodTypeAny
  switch (field.type) {
    case "number":
    case "currency":
    case "percentage":
      base = buildZodNumberForField(field)
      break
    case "boolean":
    case "switch":
      base = z.boolean()
      break
    case "multi-select":
    case "multi-autocomplete":
      base = z.array(z.string())
      break
    case "email":
      base = buildZodStringForField(field).email()
      break
    case "url":
      base = buildZodStringForField(field).url()
      break
    default:
      base = buildZodStringForField(field)
  }
  return field.required ? base : base.optional()
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a page-builder field list to a runtime Zod object schema. Hidden
 * fields are skipped so a required-but-hidden field cannot deadlock submit.
 */
export function buildZodSchema(fields: FieldSchema[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}
  for (const f of fields) {
    if (f.hidden) continue
    shape[f.name] = buildZodForField(f)
  }
  return z.object(shape)
}

/**
 * Build the `fieldConfig` prop expected by `SchemaFormRenderer` from
 * page-builder fields. All fields (including hidden) are emitted because
 * the renderer reads `hidden` per-entry to skip rendering.
 */
export function buildFieldConfig(fields: FieldSchema[]): Record<string, FormFieldConfig> {
  const out: Record<string, FormFieldConfig> = {}
  for (const f of fields) {
    out[f.name] = {
      type: mapFieldTypeToFormFieldType(f.type),
      label: f.label.en,
      placeholder: f.placeholder?.en,
      description: f.description?.en,
      required: f.required,
      hidden: f.hidden,
      disabled: f.disabled,
      defaultValue: f.defaultValue,
      options: f.options?.map(o => ({ value: o.value, label: o.label.en })),
      // `enumType` on the Page Builder schema is loose `string` while the
      // renderer expects the narrowed `EnumTypeName`. The Page Builder spec
      // intentionally leaves this loose so admins can register new enum
      // types without a code change; the renderer falls back to a string
      // display when the type is unknown.
      enumType: f.enumType as FormFieldConfig["enumType"],
      entityName: f.autocomplete?.entityName,
      valueKey: f.autocomplete?.valueField,
      customEndpoint: f.autocomplete?.apiEndpoint,
      multiple: f.type === "multi-select" || f.type === "multi-autocomplete",
      rows: f.rows,
      step: f.step,
      colSpan: f.colSpan,
    }
  }
  return out
}

/**
 * Compute initial RHF default values from the field list. Picks the
 * declared `defaultValue` if present, otherwise a type-appropriate seed
 * (empty string for text-likes, `false` for booleans, `[]` for arrays,
 * `undefined` for numbers so empty `<Input type="number">` round-trips).
 */
export function buildDefaultValues(fields: FieldSchema[]): DefaultValues<Record<string, unknown>> {
  const dv: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.defaultValue !== undefined) {
      dv[f.name] = f.defaultValue
      continue
    }
    switch (f.type) {
      case "boolean":
      case "switch":
        dv[f.name] = false
        break
      case "multi-select":
      case "multi-autocomplete":
        dv[f.name] = []
        break
      case "number":
      case "currency":
      case "percentage":
        dv[f.name] = undefined
        break
      default:
        dv[f.name] = ""
    }
  }
  return dv as DefaultValues<Record<string, unknown>>
}
