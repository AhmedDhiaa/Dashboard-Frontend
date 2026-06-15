/**
 * Page Builder field schema (per spec §3).
 *
 * Owns three concerns shared across the rest of the page-builder schema
 * surface:
 *   1. Localised string + identifier-pattern primitives (re-exported below).
 *   2. The Page Builder field-type vocabulary (28 values from §3).
 *   3. The `fieldSchema` itself — one Zod object per field declaration.
 *
 * Field types are kept in lockstep with the master union in
 * `src/core/entities/field-types.ts` via `as const satisfies readonly
 * MasterFieldType[]`. A drift between this list and the master fails
 * type-check immediately.
 *
 * No dependencies on the other page-builder schema files — this is the leaf
 * module of the schema graph, imported by every other one.
 */

import { z } from "zod"
import type { MasterFieldType } from "@/core/entities/field-types"

// ─── Length caps ────────────────────────────────────────────────────────────

const FREE_TEXT_MAX = 500

// ─── Localised strings ──────────────────────────────────────────────────────

export const localizedStringSchema = z.object({
  en: z.string().max(FREE_TEXT_MAX),
  ar: z.string().max(FREE_TEXT_MAX),
})

// ─── Identifier patterns ────────────────────────────────────────────────────
//
// Mirrors `IDENT_PATTERNS` in `src/features/admin-tools/entity-builder/types/
// builder-schema.ts`. Re-declared locally so the page-builder feature does
// not import from a sibling feature (which the architectural validator
// rejects by default).

export const kebabIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,40}$/, "must be kebab-case (e.g. 'orders-list')")
export const fieldNameSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9_]{0,40}$/, "must be a valid lowerCamelCase / snake_case identifier")
export const permissionKeySchema = z
  .string()
  .regex(/^Api\.[A-Z][A-Za-z0-9.]{1,80}$/, "permissionKey must start with 'Api.' and be PascalCase")

// ─── Page Builder field-type vocabulary ─────────────────────────────────────
//
// 28 types from spec §3. The `satisfies readonly MasterFieldType[]` guarantees
// every literal here is a member of the master union. Adding a value here
// without adding it to the master fails type-check.

export const PAGE_BUILDER_FIELD_TYPES = [
  "text",
  "textarea",
  "richtext",
  "number",
  "currency",
  "percentage",
  "boolean",
  "switch",
  "date",
  "datetime",
  "time",
  "date-range",
  "select",
  "multi-select",
  "radio",
  "autocomplete",
  "multi-autocomplete",
  "file",
  "image",
  "image-crop",
  "password",
  "email",
  "phone",
  "url",
  "enum",
  "json",
  "color",
  "map-location",
  "custom",
] as const satisfies readonly MasterFieldType[]

export type PageBuilderFieldType = (typeof PAGE_BUILDER_FIELD_TYPES)[number]

// ─── Validation rules ───────────────────────────────────────────────────────

const validationRulesSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().optional(),
  customValidator: fieldNameSchema.optional(),
})

// ─── Static option (select / radio / multi-select) ──────────────────────────

const fieldOptionSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  label: localizedStringSchema,
})

// ─── Autocomplete config (entity-backed or API-backed) ──────────────────────

const autocompleteConfigSchema = z.object({
  entityName: kebabIdSchema.optional(),
  apiEndpoint: z.string().optional(),
  valueField: fieldNameSchema,
  labelField: fieldNameSchema,
  foreignLabelField: fieldNameSchema.optional(),
})

// ─── Conditional visibility ─────────────────────────────────────────────────

const fieldConditionSchema = z.object({
  field: fieldNameSchema,
  operator: z.enum(["eq", "ne", "in", "not-in", "gt", "lt"]),
  value: z.unknown(),
})

// ─── Field schema (top-level) ───────────────────────────────────────────────

export const fieldSchema = z.object({
  name: fieldNameSchema,
  type: z.enum(PAGE_BUILDER_FIELD_TYPES),
  label: localizedStringSchema,
  description: localizedStringSchema.optional(),
  placeholder: localizedStringSchema.optional(),
  required: z.boolean().default(false),
  hidden: z.boolean().default(false),
  disabled: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  validation: validationRulesSchema.optional(),
  // Type-specific config
  options: z.array(fieldOptionSchema).optional(),
  enumType: z.string().optional(),
  autocomplete: autocompleteConfigSchema.optional(),
  rows: z.number().int().positive().optional(),
  step: z.number().optional(),
  accept: z.string().optional(),
  // Display behaviour
  colSpan: z.number().int().positive().optional(),
  showInList: z.boolean().default(false),
  showInDetail: z.boolean().default(true),
  showInForm: z.boolean().default(true),
  // Conditional visibility
  condition: fieldConditionSchema.optional(),
  permission: permissionKeySchema.optional(),
})

export type FieldSchema = z.infer<typeof fieldSchema>
