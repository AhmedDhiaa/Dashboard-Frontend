/**
 * EntityBuilderSchema — single source of truth for an entity's UI + behavior.
 *
 * The same JSON drives the visual editor (Task 15+) AND the code generator
 * (later tasks). Keeping the shape serialisable (no functions, no refs)
 * means a schema can round-trip through the API, the editor, and a code
 * template without lossy conversions.
 *
 * Zod schemas exposed alongside the TS types so the API + the editor share
 * one runtime validator. `EntityBuilderSchema` (TS) is `z.infer` of
 * `entityBuilderSchema` (Zod) — they cannot drift.
 */

import { z } from "zod"
import type { BuilderSchemaFieldType } from "@/core/entities/field-types"
import type { BuilderDisplayColumnType } from "@/core/entities/column-types"

// ─── Length caps for free-text inputs ────────────────────────────────────────
//
// Even though every free-text label / placeholder / description goes through
// JSON.stringify before it lands in source (so injection isn't possible),
// uncapped strings are still a denial-of-service vector — they bloat the
// generated file, the i18n bundle, and the audit log. 200 chars covers any
// realistic label or placeholder; 500 covers the longer-form descriptions.
const FREE_TEXT_MAX = 200
const LONG_TEXT_MAX = 500

// ─── Identifier patterns ─────────────────────────────────────────────────────
//
// These regexes are the *root* of the codegen security model. Anything that
// becomes a JS identifier (entity name, field name, permission key, …) inside
// a generated source file MUST come through these patterns. Anything that
// doesn't pass either fails Zod at the API boundary OR fails the
// `assertSafeIdent` re-check inside the codegen templates — defense in depth
// so a regex bug or a bypassed validator can't write code from raw input.
//
// Length caps are deliberately tight: real-world entity / field / permission
// names are well under 50 chars; anything longer is suspicious.
export const IDENT_PATTERNS = {
  /** kebab-case lowercase, e.g. "customer", "purchase-invoice". */
  kebab: /^[a-z][a-z0-9-]{1,40}$/,
  /** lowerCamelCase / snake_case TS identifier, e.g. "totalAmount", "is_active". */
  fieldName: /^[a-z][a-zA-Z0-9_]{0,40}$/,
  /** ABP permission key starting with the `Api.` namespace, e.g. "Api.Customer". */
  permissionKey: /^Api\.[A-Z][A-Za-z0-9.]{1,80}$/,
  /** ABP endpoint path, e.g. "/api/app/customer". */
  endpoint: /^\/[a-zA-Z0-9/_-]{1,200}$/,
  /** Lucide icon name, e.g. "User", "ShoppingCart". */
  icon: /^[A-Z][A-Za-z0-9]{0,40}$/,
  /** Stable id (kebab) used as React keys / drag targets / section ids. */
  id: /^[a-z][a-z0-9-_]{0,40}$/,
  /** ABP enum type name, e.g. "InvoiceStatus". */
  enumName: /^[A-Z][A-Za-z0-9]{0,40}$/,
} as const

// ─── Localised strings ───────────────────────────────────────────────────────

const localisedStringSchema = z.object({
  en: z.string().max(FREE_TEXT_MAX),
  ar: z.string().max(FREE_TEXT_MAX),
})

// ─── Entity-level translation bag ────────────────────────────────────────────

const entityTranslationKeysSchema = z.object({
  title: z.string().max(FREE_TEXT_MAX),
  description: z.string().max(LONG_TEXT_MAX).optional(),
  searchPlaceholder: z.string().max(FREE_TEXT_MAX).optional(),
  detailTitle: z.string().max(FREE_TEXT_MAX).optional(),
  createTitle: z.string().max(FREE_TEXT_MAX).optional(),
  editTitle: z.string().max(FREE_TEXT_MAX).optional(),
})
// ─── Validation rules ────────────────────────────────────────────────────────

const validationRulesSchema = z.object({
  minLength: z.number().int().nonnegative().max(100_000).optional(),
  maxLength: z.number().int().positive().max(100_000).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  /** Stored as a string; the consumer calls `new RegExp(pattern)`. */
  pattern: z.string().max(FREE_TEXT_MAX).optional(),
  /**
   * Reference to a registered custom validator (resolved by the runtime).
   * Identifier-shape so a malicious "; drop table x" can't appear in a
   * generated import path.
   */
  customValidator: z.string().regex(IDENT_PATTERNS.fieldName).optional(),
})
export type ValidationRules = z.infer<typeof validationRulesSchema>

// ─── API autocomplete config ─────────────────────────────────────────────────

const apiAutocompleteConfigSchema = z.object({
  endpoint: z.string().regex(IDENT_PATTERNS.endpoint, "endpoint must look like an API path"),
  /** Query-string parameter the search term is sent as (default: 'q'). */
  queryParam: z.string().regex(IDENT_PATTERNS.fieldName).default("q"),
  /** Path inside the response payload to the array of items (default: 'items'). Dot-paths permitted. */
  itemsPath: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9_.]{0,80}$/, "itemsPath must be a dot-path identifier")
    .default("items"),
  /** Property on each item used as the option's value. */
  valueField: z.string().regex(IDENT_PATTERNS.fieldName),
  /** Property on each item used as the visible label. */
  labelField: z.string().regex(IDENT_PATTERNS.fieldName),
  /** Optional secondary field for an Arabic / foreign-name fallback. */
  foreignLabelField: z.string().regex(IDENT_PATTERNS.fieldName).optional(),
})

// ─── Tags config ─────────────────────────────────────────────────────────────

const tagsConfigSchema = z.object({
  /**
   * Cap on the array length the form will accept. Positive integer, capped
   * at 1000 to bound the generated FormFieldConfig — the upper bound
   * matches the spirit of `maxSizeKB`'s 1_000_000 ceiling: large enough
   * for any realistic use, small enough that a runaway value can't be
   * smuggled through.
   */
  maxCount: z.number().int().positive().max(1000).optional(),
  /** When true, identical strings can appear more than once. Default false. */
  allowDuplicates: z.boolean().optional(),
})

// ─── Field types ─────────────────────────────────────────────────────────────

// `satisfies readonly BuilderSchemaFieldType[]` enforces that every literal here
// is also a member of the master field-type union (src/core/entities/field-types.ts).
// A drift between this tuple and the master becomes a compile-time error.
export const FIELD_TYPES = [
  "string",
  "text",
  "richtext",
  "number",
  "currency",
  "percentage",
  "boolean",
  "date",
  "datetime",
  "time",
  "select",
  "multi-select",
  "enum",
  "entity-autocomplete",
  "api-autocomplete",
  "file",
  "image",
  "phone",
  "email",
  "url",
  "color",
  "tags",
] as const satisfies readonly BuilderSchemaFieldType[]
export type FieldType = (typeof FIELD_TYPES)[number]

const fieldTypeSchema = z.enum(FIELD_TYPES)

// ─── Cross-field dependency (conditional rendering) ──────────────────────────

const fieldDependencySchema = z.object({
  field: z.string().regex(IDENT_PATTERNS.fieldName),
  /** Equality value — must be JSON-serialisable. */
  equals: z.union([z.string().max(FREE_TEXT_MAX), z.number(), z.boolean(), z.null()]),
})
// ─── Static select option ────────────────────────────────────────────────────

const selectOptionSchema = z.object({
  /**
   * Wire value for the option. Always emitted through `safeStringLit`
   * (JSON-escaped) so the character set isn't a security concern — only
   * length is. Common values are enum tokens like "USD", "active", or "1".
   */
  value: z.string().min(1).max(FREE_TEXT_MAX),
  /** Translation key, dot-path style. Identifier-shape for codegen safety. */
  labelKey: z.string().regex(/^[A-Za-z][A-Za-z0-9._-]{0,120}$/, "labelKey must be a dot-path translation key"),
})
// ─── Field definition ────────────────────────────────────────────────────────

const fieldNameSchema = z.string().regex(IDENT_PATTERNS.fieldName, "field name must be a valid identifier")

const entityFieldDefinitionSchema = z
  .object({
    name: fieldNameSchema,
    type: fieldTypeSchema,
    label: localisedStringSchema,
    placeholder: localisedStringSchema.optional(),
    required: z.boolean().optional(),
    hidden: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    dependsOn: fieldDependencySchema.optional(),
    permissionKey: z.string().regex(IDENT_PATTERNS.permissionKey).optional(),
    validation: validationRulesSchema.optional(),
    enumName: z.string().regex(IDENT_PATTERNS.enumName).optional(),
    entityRef: z.string().regex(IDENT_PATTERNS.kebab).optional(),
    apiConfig: apiAutocompleteConfigSchema.optional(),
    options: z.array(selectOptionSchema).max(200).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    /** File-input MIME / extension list, e.g. "image/*,.pdf". */
    accept: z
      .string()
      .regex(/^[a-zA-Z0-9.,*/_+-]{1,200}$/)
      .optional(),
    /**
     * Soft size cap for file/image uploads. Validated at form-submit time;
     * the generator emits it as a `maxSizeKB` key on the FormFieldConfig.
     */
    maxSizeKB: z.number().int().positive().max(1_000_000).optional(),
    /**
     * ISO 4217 currency code for `type="currency"` fields. Length cap to
     * 3 keeps the codegen string interpolation safe even without the
     * regex; we still constrain to an uppercase 3-letter token below.
     */
    currencyCode: z
      .string()
      .regex(/^[A-Z]{3}$/, "currencyCode must be a 3-letter ISO code (e.g. USD, EUR, IQD)")
      .optional(),
    /**
     * Display-field name on the referenced target entity, for
     * `type="entity-autocomplete"`. Identifier-shape so a malicious
     * "name; drop table x" can never appear in a generated source string.
     */
    displayField: z.string().regex(IDENT_PATTERNS.fieldName).optional(),
    /** Per-type extras for `type="tags"`. Both knobs are optional. */
    tagsConfig: tagsConfigSchema.optional(),
  })
  // Type-specific shape requirements live here so a malformed schema fails
  // loudly at the API boundary rather than at render time deep in the UI.
  .superRefine((field, ctx) => {
    const need = (cond: boolean, path: string, message: string) => {
      if (!cond) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    }
    if (field.type === "enum") need(!!field.enumName, "enumName", "enumName required for type=enum")
    if (field.type === "entity-autocomplete")
      need(!!field.entityRef, "entityRef", "entityRef required for type=entity-autocomplete")
    if (field.type === "api-autocomplete")
      need(!!field.apiConfig, "apiConfig", "apiConfig required for type=api-autocomplete")
    if (field.type === "select" || field.type === "multi-select") {
      need(
        Array.isArray(field.options) && field.options.length > 0,
        "options",
        "options[] required for type=select/multi-select",
      )
    }
  })
export type EntityFieldDefinition = z.infer<typeof entityFieldDefinitionSchema>

// ─── List column ────────────────────────────────────────────────────────────

// `satisfies readonly BuilderDisplayColumnType[]` ensures every literal here is
// also a member of the master column-type union (src/core/entities/column-types.ts).
const DISPLAY_COLUMN_TYPES = [
  "text",
  "text-primary",
  "text-arabic",
  "badge",
  "badge-code",
  "boolean",
  "date",
  "datetime",
  "currency",
  "percentage",
  "image",
  "tags",
] as const satisfies readonly BuilderDisplayColumnType[]

const listColumnDefinitionSchema = z.object({
  field: fieldNameSchema,
  /** Display kind picked by the table renderer (text, badge, date, …). */
  display: z.enum(DISPLAY_COLUMN_TYPES).default("text"),
  width: z.number().int().positive().optional(),
  sortable: z.boolean().default(true),
  hidden: z.boolean().default(false),
  /** Header-cell label override; falls back to the field's `label` when absent. */
  title: localisedStringSchema.optional(),
  /** Cell + header alignment. Renderer treats undefined as "start". */
  align: z.enum(["start", "center", "end"]).optional(),
  /** Whether this column shows in the toolbar's filter row. */
  filterable: z.boolean().optional(),
  /** Whether the cell can be edited in place from the list view. */
  inlineEditable: z.boolean().optional(),
})
export type ListColumnDefinition = z.infer<typeof listColumnDefinitionSchema>

// ─── Detail section ─────────────────────────────────────────────────────────

const detailSectionDefinitionSchema = z.object({
  id: z.string().regex(IDENT_PATTERNS.id),
  title: localisedStringSchema,
  /** Field names rendered inside this section, top-to-bottom. */
  fields: z.array(fieldNameSchema).min(1).max(200),
  collapsible: z.boolean().default(false),
  /** Lucide icon name shown next to the section title. */
  icon: z.string().regex(IDENT_PATTERNS.icon).optional(),
})
// ─── Form layout (rows of side-by-side fields) ──────────────────────────────

const formRowDefinitionSchema = z.object({
  /** Stable id used as the React key + as the drag-target id. */
  id: z.string().regex(IDENT_PATTERNS.id).optional(),
  /** Field names to render in this row. Length 1-6 matches the column-count options. */
  fields: z.array(fieldNameSchema).min(1).max(6),
  /** Optional section heading rendered above this row. */
  sectionTitle: localisedStringSchema.optional(),
  /** Grid column count. Defaults to fields.length when absent. */
  columnCount: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]).optional(),
  /** Lucide icon name shown next to the section title (e.g. "User"). */
  icon: z.string().regex(IDENT_PATTERNS.icon).optional(),
  /** When set, this row belongs to the matching tab from formTabs[]. */
  tabId: z.string().regex(IDENT_PATTERNS.id).optional(),
})
const formTabDefinitionSchema = z.object({
  id: z.string().regex(IDENT_PATTERNS.id),
  title: localisedStringSchema,
  /** Lucide icon name for the tab trigger. */
  icon: z.string().regex(IDENT_PATTERNS.icon).optional(),
})
// ─── Bulk action ────────────────────────────────────────────────────────────

const bulkActionDefinitionSchema = z.object({
  id: z.string().regex(IDENT_PATTERNS.id),
  label: localisedStringSchema,
  action: z.enum(["delete", "export", "publish", "archive", "custom"]),
  /** Reference to a registered handler — required when action='custom'. */
  customHandler: z.string().regex(IDENT_PATTERNS.fieldName).optional(),
  /** API endpoint hit for action='custom'. Selected ids POSTed as { ids: [...] }. */
  endpoint: z.string().regex(IDENT_PATTERNS.endpoint).optional(),
  /** Lucide icon name for the button. */
  icon: z.string().regex(IDENT_PATTERNS.icon).optional(),
  permissionKey: z.string().regex(IDENT_PATTERNS.permissionKey).optional(),
  confirm: z.boolean().default(true),
  /** Optional confirmation-dialog body. Falls back to the action verb when absent. */
  confirmText: localisedStringSchema.optional(),
})
export type BulkActionDefinition = z.infer<typeof bulkActionDefinitionSchema>

// ─── Filter definition ──────────────────────────────────────────────────────

const filterDefinitionSchema = z.object({
  field: fieldNameSchema,
  /** Comparison operator the backend will apply. */
  operator: z.enum(["eq", "neq", "contains", "starts_with", "in", "between", "gt", "lt", "gte", "lte"]),
  /** Picks the filter-drawer widget independently of the wire-level operator. */
  widget: z.enum(["text", "multi-select", "date-range", "boolean"]).optional(),
  defaultValue: z
    .union([
      z.string().max(FREE_TEXT_MAX),
      z.number(),
      z.boolean(),
      z.array(z.string().max(FREE_TEXT_MAX)).max(50),
      z.null(),
    ])
    .optional(),
  label: localisedStringSchema.optional(),
})
export type FilterDefinition = z.infer<typeof filterDefinitionSchema>

// ─── System columns (row number + actions + custom buttons) ────────────────

const customActionSchema = z.object({
  id: z.string().regex(IDENT_PATTERNS.id),
  label: localisedStringSchema,
  /** lucide icon name (e.g. "Send"). UI looks it up at render time. */
  icon: z.string().regex(IDENT_PATTERNS.icon).optional(),
  permissionKey: z.string().regex(IDENT_PATTERNS.permissionKey).optional(),
})
const systemColumnsSchema = z.object({
  rowNumber: z.boolean().default(false),
  actions: z
    .object({
      view: z.boolean().default(true),
      edit: z.boolean().default(true),
      delete: z.boolean().default(true),
    })
    .default({ view: true, edit: true, delete: true }),
  customActions: z.array(customActionSchema).default([]),
})
// ─── Top-level entity schema ────────────────────────────────────────────────

const featuresSchema = z.object({
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
  view: z.boolean(),
  export: z.boolean(),
  import: z.boolean(),
})

export const entityBuilderSchema = z
  .object({
    /**
     * Becomes a TypeScript identifier in the generated source — must be
     * a strict kebab-case slug. The length cap (2-41 chars) keeps file
     * names + import paths bounded.
     */
    entityName: z.string().regex(IDENT_PATTERNS.kebab, "entityName must be kebab-case (e.g. 'customer')"),
    entityNamePlural: z.string().regex(IDENT_PATTERNS.kebab, "entityNamePlural must be kebab-case (e.g. 'customers')"),
    /** Becomes a folder under `src/domains/<domain>/`. Same shape as entityName. */
    domain: z.string().regex(IDENT_PATTERNS.kebab, "domain must be kebab-case (e.g. 'business')"),
    /**
     * ABP-style API endpoint, e.g. `/api/app/customer`. Constrained to a
     * narrow character class so this string is safe to inline inside a JS
     * string literal in the generated service.
     */
    endpoint: z.string().regex(IDENT_PATTERNS.endpoint, "endpoint must be an API path like '/api/app/customer'"),
    /**
     * ABP permission key — must start with the `Api.` namespace so the
     * leading characters are predictable for the codegen permission helpers.
     */
    permissionKey: z
      .string()
      .regex(
        IDENT_PATTERNS.permissionKey,
        "permissionKey must start with 'Api.' and be PascalCase (e.g. 'Api.Customer')",
      ),
    translations: z.object({
      en: entityTranslationKeysSchema,
      ar: entityTranslationKeysSchema,
    }),
    fields: z.array(entityFieldDefinitionSchema).min(1, "at least one field required").max(200),
    listColumns: z.array(listColumnDefinitionSchema).min(1, "at least one list column required").max(100),
    detailLayout: z.array(detailSectionDefinitionSchema).max(50).default([]),
    formLayout: z.array(formRowDefinitionSchema).max(100).default([]),
    bulkActions: z.array(bulkActionDefinitionSchema).max(50).optional(),
    filters: z.array(filterDefinitionSchema).max(100).optional(),
    systemColumns: systemColumnsSchema.optional(),
    formTabs: z.array(formTabDefinitionSchema).max(20).optional(),
    features: featuresSchema,
  })
  // Cross-section integrity: every column / detail / form / dependency / filter
  // must reference a field that actually exists. Catches typos early.
  .superRefine((schema, ctx) => {
    const fieldNames = new Set(schema.fields.map(f => f.name))

    const checkRef = (name: string, path: (string | number)[], context: string) => {
      if (!fieldNames.has(name)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${context} references unknown field '${name}'` })
      }
    }

    schema.listColumns.forEach((col, i) => checkRef(col.field, ["listColumns", i, "field"], "listColumns"))
    schema.detailLayout.forEach((sec, i) =>
      sec.fields.forEach((name, j) => checkRef(name, ["detailLayout", i, "fields", j], "detailLayout")),
    )
    schema.formLayout.forEach((row, i) =>
      row.fields.forEach((name, j) => checkRef(name, ["formLayout", i, "fields", j], "formLayout")),
    )
    schema.fields.forEach((f, i) => {
      if (f.dependsOn) checkRef(f.dependsOn.field, ["fields", i, "dependsOn", "field"], "dependsOn")
    })
    schema.filters?.forEach((f, i) => checkRef(f.field, ["filters", i, "field"], "filters"))
  })

export type EntityBuilderSchema = z.infer<typeof entityBuilderSchema>
