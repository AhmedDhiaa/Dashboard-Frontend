/**
 * Runtime Builder — Type Definitions
 *
 * A frontend-only, JSON-driven mini-CMS layer. Everything users build via
 * the UI is persisted as plain JSON in the browser (localStorage today,
 * any DataProvider tomorrow). These types are the contract between the
 * builder UI, the storage layer, and the auto-generated CRUD engine.
 */

/**
 * Field-type union exposed by the runtime builder UI.
 *
 * Mirrors `BuilderSchemaFieldType` (22 values) — every type below has a
 * render branch in `DynamicForm.FieldControl` and a cell formatter in
 * `DynamicTable.formatCell`. `enum`, `api-autocomplete`, and `tags`
 * are renderable here but are not yet wired into the wizard
 * (`EntityFieldEditor`) or the materialize pipeline; setting them
 * requires writing the config blob directly until those passes land.
 *
 * Adding a new type? Update, in order:
 *   1. this union
 *   2. EntityFieldEditor's FIELD_TYPES + per-type sub-editor
 *   3. DynamicForm.FieldControl render branch + DynamicTable.formatCell
 *   4. runtime-to-builder-schema.ts TYPE_MAP + per-type extras carryover
 *   5. file-generators.ts tsType + zodLine + configFile extras
 */
export type RuntimeFieldType =
  | "text"
  | "textarea"
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
  | "entity-autocomplete"
  | "file"
  | "image"
  | "phone"
  | "email"
  | "url"
  | "color"
  | "enum"
  | "api-autocomplete"
  | "tags"

export interface RuntimeFieldOption {
  value: string
  label: string
}

export interface RuntimeFieldValidation {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
}

// ─── Per-type config sub-objects ─────────────────────────────────────────────
//
// Each interface is a serialisable JSON blob; the type-conditional sub-editor
// in EntityFieldEditor writes it and the mapper / generator read it. Keeping
// them as separate interfaces (rather than a `Record<string, unknown>` bag)
// gives every callsite type-checking on the specific keys it touches.

export interface RuntimeCurrencyConfig {
  /** ISO 4217 currency code (e.g. "USD", "EUR", "IQD"). */
  currencyCode?: string
  /** BCP-47 locale tag for Intl.NumberFormat (e.g. "en-US"). */
  locale?: string
}

export interface RuntimeFileConfig {
  /** MIME / extension patterns the picker accepts (e.g. ["image/*", ".pdf"]). */
  accept?: string[]
  /** Soft cap; the form-level validator surfaces an error if exceeded. */
  maxSizeKB?: number
}

export interface RuntimeEntityAutocompleteConfig {
  /** Id of the target RuntimeEntity to look records up against. */
  targetEntityName: string
  /** Field on the target entity used as the visible label. */
  displayField: string
}

export interface RuntimeEnumConfig {
  /** Enum type name passed to `/api/app/enum/${enumType}` (e.g. "status"). */
  enumType: string
  /** Property on each EnumValue to use as the option value. Defaults to "id". */
  valueField?: "id" | "code"
  /** Property to use as the visible label. Defaults to "name". */
  displayField?: "name" | "foreignName"
}

export interface RuntimeApiAutocompleteConfig {
  /** Absolute or relative URL hit on mount to populate options. */
  endpoint: string
  /** Property on each fetched row to use as the option value. */
  valueField: string
  /** Property to use as the visible label. */
  labelField: string
}

export interface RuntimeTagsConfig {
  /** Maximum number of tags the user can add. Unset = no cap. */
  maxCount?: number
  /** When true, the same string can appear twice. Default false. */
  allowDuplicates?: boolean
}

export interface RuntimeField {
  /** Stable key used as the property name in stored records */
  key: string
  /** Display label (English / default). */
  label: string
  /** Arabic display label. Falls back to `label` when unset, so the
   *  materialize pipeline emits real Arabic instead of mirrored English. */
  labelAr?: string
  type: RuntimeFieldType
  required?: boolean
  defaultValue?: unknown
  placeholder?: string
  description?: string
  /** Only for type="select" / "multi-select" */
  options?: RuntimeFieldOption[]
  validation?: RuntimeFieldValidation
  /** When true, used as the primary display column in tables and lists */
  isTitle?: boolean
  /** Only for type="currency". */
  currencyConfig?: RuntimeCurrencyConfig
  /** Only for type="file" / "image". */
  fileConfig?: RuntimeFileConfig
  /** Only for type="entity-autocomplete". */
  entityAutocompleteConfig?: RuntimeEntityAutocompleteConfig
  /** Only for type="enum". */
  enumConfig?: RuntimeEnumConfig
  /** Only for type="api-autocomplete". */
  apiAutocompleteConfig?: RuntimeApiAutocompleteConfig
  /** Only for type="tags". */
  tagsConfig?: RuntimeTagsConfig
}

/**
 * Per-entity feature flags. When a runtime entity is materialised into
 * source files these become the `features` block of the generated
 * EntityConfig — and they also gate which CRUD buttons render in the
 * runtime data view.
 */
export interface RuntimeFeatures {
  create?: boolean
  edit?: boolean
  delete?: boolean
  view?: boolean
  export?: boolean
  import?: boolean
}

/**
 * List-view filter. Mirrors the wizard's `FilterDefinition` (see
 * EntityBuilderSchema.filters) using only the operators and widgets the
 * runtime UI exposes today. The materialize mapper widens these into the
 * full wizard shape.
 */
export type RuntimeFilterOperator = "eq" | "neq" | "contains" | "gt" | "lt" | "gte" | "lte"
export type RuntimeFilterWidget = "text" | "boolean" | "date-range"

export interface RuntimeFilter {
  /** Stable id for keying in editors */
  id: string
  /** Field key the filter targets */
  field: string
  operator: RuntimeFilterOperator
  widget?: RuntimeFilterWidget
  label?: string
}

/**
 * Toolbar-level bulk action. Subset of the wizard's `BulkActionDefinition`
 * — the runtime builder doesn't expose `customHandler` references because
 * they have no meaning until the entity is materialised.
 */
export type RuntimeBulkActionKind = "delete" | "export" | "publish" | "archive"

export interface RuntimeBulkAction {
  id: string
  label: string
  kind: RuntimeBulkActionKind
  confirm?: boolean
  /** Lucide icon name — looked up at render time */
  icon?: string
}

/**
 * Optional sidebar metadata persisted with each runtime entity. The
 * materialize flow reads this to drive the navigation patcher; nothing
 * else in the runtime UI reads it today.
 */
export interface RuntimeEntityNavigation {
  /** Existing nav-group titleKey (e.g. "nav.master_data"). */
  group?: string
  /** Lower = appears earlier in the group's items[]. */
  order?: number
  /** Lucide icon name picked from the curated list. */
  icon?: string
  /** Translation key for the sidebar label. */
  titleKey?: string
  /** Override the default `/<plural>` href. */
  href?: string
}

export interface RuntimeEntity {
  /** Stable URL-safe id (e.g. "customers") */
  id: string
  /** Human label, plural (e.g. "Customers") */
  pluralName: string
  /** Arabic plural label. Falls back to `pluralName` when unset. */
  pluralNameAr?: string
  /** Human label, singular (e.g. "Customer") */
  singularName: string
  /** Arabic singular label. Falls back to `singularName` when unset. */
  singularNameAr?: string
  /** Lucide icon name — looked up in iconMap */
  icon?: string
  description?: string
  /** Arabic description. Falls back to `description` when unset. */
  descriptionAr?: string
  fields: RuntimeField[]
  /**
   * ABP permission key prefix (e.g. "Api.Customer"). Optional because
   * runtime entities don't enforce ABP permissions until materialised; the
   * mapper falls back to `Api.<PascalCase(id)>` when absent.
   */
  permissionKey?: string
  /**
   * Sidebar registration the materialize pipeline writes into
   * `navigation.ts`. All fields optional — the materialize summary card
   * fills defaults at write time. Saving a partial block here is fine.
   */
  navigation?: RuntimeEntityNavigation
  /** Capabilities exposed in the data view + materialised config. */
  features?: RuntimeFeatures
  /** List-view filters surfaced in the toolbar. */
  filters?: RuntimeFilter[]
  /** Bulk actions surfaced in the toolbar when rows are selected. */
  bulkActions?: RuntimeBulkAction[]
  createdAt: number
  updatedAt: number
}

export type RuntimePageType = "entity" | "dashboard" | "custom"

export interface RuntimePage {
  id: string
  title: string
  icon?: string
  type: RuntimePageType
  /** For type="entity" — id of the bound entity */
  entityId?: string
  /** For type="dashboard" — id of the dashboard config */
  dashboardId?: string
  /** Display order in the sidebar (lower = first) */
  order: number
  enabled: boolean
}

export type RuntimeWidgetKind = "stat" | "table" | "chart"

export interface RuntimeWidget {
  id: string
  kind: RuntimeWidgetKind
  title: string
  /** Bound entity id (data source) */
  entityId?: string
  /**
   * For "stat": which numeric field to aggregate (or "count" for record count)
   * For "table": comma-separated columns to show
   * For "chart": numeric field to plot vs the title field
   */
  config?: {
    aggregation?: "count" | "sum" | "avg" | "min" | "max"
    field?: string
    columns?: string[]
    chartType?: "bar" | "line"
    limit?: number
  }
  /** Grid span 1..4 */
  span?: number
}

export interface RuntimeDashboard {
  id: string
  title: string
  widgets: RuntimeWidget[]
}

export interface RuntimeSettings {
  /** Bumped on every config write — used as a cache key for live refresh */
  version: number
}

/**
 * The full configuration blob (entities + pages + dashboards + settings).
 * This is what export/import round-trips.
 */
export interface RuntimeConfig {
  entities: RuntimeEntity[]
  pages: RuntimePage[]
  dashboards: RuntimeDashboard[]
  settings: RuntimeSettings
}

/** A single record stored against an entity */
export type RuntimeRecord = {
  id: string
  createdAt: number
  updatedAt: number
} & Record<string, unknown>

export interface ListParams {
  search?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export interface ListResult<T> {
  items: T[]
  totalCount: number
}

/**
 * The DataProvider abstraction. Today: localStorage. Tomorrow: REST/GraphQL.
 * The UI never imports a concrete adapter directly — it goes through the
 * provider returned by `useRuntimeProvider()`.
 */
export interface DataProvider {
  // --- Config (entities + pages + dashboards) ---
  loadConfig(): RuntimeConfig
  saveConfig(config: RuntimeConfig): void
  resetConfig(): void

  // --- Per-entity record CRUD ---
  list<T extends RuntimeRecord = RuntimeRecord>(entityId: string, params?: ListParams): ListResult<T>
  get<T extends RuntimeRecord = RuntimeRecord>(entityId: string, id: string): T | undefined
  create<T extends RuntimeRecord = RuntimeRecord>(entityId: string, data: Partial<T>): T
  update<T extends RuntimeRecord = RuntimeRecord>(entityId: string, id: string, data: Partial<T>): T
  remove(entityId: string, id: string): void

  // --- Subscription (for live refresh) ---
  subscribe(listener: () => void): () => void
}
