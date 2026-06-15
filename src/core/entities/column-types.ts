/**
 * Master column-type union — single source of truth.
 *
 * Two parallel column taxonomies exist:
 *   - `FieldRendererType` in `src/ui/crud/renderers/field-renderers.tsx`
 *     (18 values — what the renderer actually knows how to draw)
 *   - `ListColumnDefinition.display` in
 *     `src/features/admin-tools/entity-builder/types/builder-schema.ts`
 *     (12 values — what an admin can pick in the JSON editor)
 *
 * Both derive from the master tuple below via `Extract`. The Page Builder
 * uses the full superset. Drift = compile-time error.
 */

export const MASTER_COLUMN_TYPES = [
  // ─── Shared (overlap) ───────────────────────────────────────────────────
  "text-primary",
  "text-arabic",
  "badge",
  "badge-code",
  "boolean",
  "date",
  "datetime",
  "currency",
  // ─── Renderer-only ──────────────────────────────────────────────────────
  "text-secondary",
  "boolean-system",
  "relation",
  "badge-status",
  "number",
  "enum",
  "map-location",
  "custom",
  "button",
  "action-button",
  // ─── Builder-display-only ───────────────────────────────────────────────
  "text",
  "percentage",
  "image",
  "tags",
  // ─── Page Builder spec §3 additions ─────────────────────────────────────
  "badge-count",
  "time",
  "image-thumbnail",
  "avatar",
  "user-cell",
  "entity-link",
] as const

export type MasterColumnType = (typeof MASTER_COLUMN_TYPES)[number]

/**
 * 18-value subset rendered by `FieldRenderer`.
 */
export type RendererColumnType = Extract<
  MasterColumnType,
  | "badge-code"
  | "text-primary"
  | "text-arabic"
  | "text-secondary"
  | "date"
  | "datetime"
  | "boolean"
  | "boolean-system"
  | "relation"
  | "badge-status"
  | "number"
  | "currency"
  | "enum"
  | "map-location"
  | "custom"
  | "badge"
  | "button"
  | "action-button"
>

/**
 * 12-value subset accepted by the entity-builder JSON `display` enum.
 */
export type BuilderDisplayColumnType = Extract<
  MasterColumnType,
  | "text"
  | "text-primary"
  | "text-arabic"
  | "badge"
  | "badge-code"
  | "boolean"
  | "date"
  | "datetime"
  | "currency"
  | "percentage"
  | "image"
  | "tags"
>
