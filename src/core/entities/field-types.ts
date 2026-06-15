/**
 * Master field-type union — single source of truth.
 *
 * The codebase historically carried two parallel field-type taxonomies:
 *   - `FormFieldConfig.type` (13 values, used by 51 entity configs)
 *   - `EntityBuilderSchema.FIELD_TYPES` (22 values, used by entity-builder JSON drafts)
 *
 * Both unions now derive from the master tuple below. Adding a new field
 * type means adding a literal here exactly once; the existing taxonomies
 * pick the subset they support, and the Page Builder uses the full
 * superset. Drift between unions becomes a compile-time error.
 */

export const MASTER_FIELD_TYPES = [
  // ─── Shared (overlap between FormFieldConfig + builder-schema) ──────────
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "select",
  "file",
  "email",
  "enum",
  // ─── FormFieldConfig-only (legacy entity-config registry) ───────────────
  "textarea",
  "autocomplete",
  "custom",
  "password",
  // ─── Builder-schema-only (entity-builder JSON drafts) ───────────────────
  "string",
  "richtext",
  "currency",
  "percentage",
  "time",
  "multi-select",
  "entity-autocomplete",
  "api-autocomplete",
  "image",
  "phone",
  "url",
  "color",
  "tags",
  // ─── Page Builder spec §3 additions ─────────────────────────────────────
  "switch",
  "date-range",
  "radio",
  "multi-autocomplete",
  "image-crop",
  "json",
  "map-location",
] as const

export type MasterFieldType = (typeof MASTER_FIELD_TYPES)[number]

/**
 * 13-value subset used by `FormFieldConfig.type` (legacy entity-config registry).
 * `Extract` guarantees every member also exists in `MasterFieldType` —
 * a typo here would be a compile error.
 */
export type EntityConfigFieldType = Extract<
  MasterFieldType,
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "autocomplete"
  | "date"
  | "datetime"
  | "boolean"
  | "file"
  | "custom"
  | "password"
  | "email"
  | "enum"
  | "tags"
>

/**
 * 22-value subset used by entity-builder JSON drafts.
 */
export type BuilderSchemaFieldType = Extract<
  MasterFieldType,
  | "string"
  | "text"
  | "richtext"
  | "number"
  | "currency"
  | "percentage"
  | "boolean"
  | "date"
  | "datetime"
  | "time"
  | "select"
  | "multi-select"
  | "enum"
  | "entity-autocomplete"
  | "api-autocomplete"
  | "file"
  | "image"
  | "phone"
  | "email"
  | "url"
  | "color"
  | "tags"
>
