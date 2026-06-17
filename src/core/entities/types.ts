/**
 * Entity Configuration System - Type Definitions
 *
 * @strict @enterprise-grade
 * Single source of truth for all entity configurations
 */

import React from "react"
import type { LucideIcon } from "lucide-react"
import type { ZodSchema } from "zod"
import type { ColumnMetadata } from "@/ui/crud/renderers/table-column-factory"
import type { DetailSection } from "@/core/crud/components/BaseDetailRenderer"
import type { FilterField } from "@/shared/types/filters"
import type { CRUDListParams, Page } from "@/shared/ports/backend"
import type { EnumTypeName } from "@/core/enums"
import type { EntityConfigFieldType } from "./field-types"

/**
 * Translation keys for entity UI
 */
export interface EntityTranslations {
  listTitle: string
  listDescription: string
  detailTitle: string
  createTitle: string
  editTitle: string
  searchPlaceholder: string
  successCreate?: string
  successUpdate?: string
  successDelete?: string
}

/**
 * Feature flags for entity capabilities
 */
export interface EntityFeatures {
  create?: boolean
  edit?: boolean
  delete?: boolean
  view?: boolean
  export?: boolean
  import?: boolean
  bulkDelete?: boolean
}

/**
 * Sort configuration
 */
export interface SortConfig<T = unknown> {
  field: keyof T | string
  direction: "asc" | "desc"
}

/**
 * Form field configuration - Unified across the system
 */
export interface FormFieldConfig {
  type: EntityConfigFieldType
  label?: string
  labelKey?: string
  description?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hidden?: boolean
  defaultValue?: unknown
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    custom?: (value: unknown) => boolean | string
  }
  options?: Array<{ value: unknown; label?: string; labelKey?: string }>
  dependsOn?: string[]
  condition?: (formValues: Record<string, unknown>) => boolean

  // Custom rendering support
  customRender?: (name: string, label: string, required: boolean) => React.ReactNode

  // UI Specific fields
  rows?: number
  entityName?: string
  renderSelected?: (item: unknown) => React.ReactNode
  renderItem?: (item: unknown) => React.ReactNode
  searchPlaceholder?: string
  min?: number | string
  max?: number | string
  step?: number | string
  className?: string
  colSpan?: number
  multiple?: boolean
  valueKey?: string
  customEndpoint?: string
  basePath?: string
  enumType?: EnumTypeName
  direction?: "ltr" | "rtl"

  // ─── Per-type extras (set by the entity-builder generator) ────────────────
  // Added when the materialize pipeline emits a richer config: currency
  // fields carry `currencyCode`, file/image fields carry `accept` +
  // `maxSizeKB`, entity-autocomplete fields carry `displayField`. All are
  // optional so handwritten configs that don't set them stay valid.
  /** ISO 4217 currency code shown next to the value (e.g. "USD"). */
  currencyCode?: string
  /** MIME / extension list for file pickers (`<input accept>` string). */
  accept?: string
  /** Soft upload size cap in kilobytes (form-level validation). */
  maxSizeKB?: number
  /** Field on the referenced entity used as the visible label (autocomplete). */
  displayField?: string
  /** Cap on array length for `type: "tags"`. Form-level validation. */
  maxCount?: number
  /** When false (default), commit-on-Enter rejects values already in the array. */
  allowDuplicates?: boolean
}

/**
 * Complete entity configuration
 */
export interface EntityConfig<TEntity = Record<string, unknown>, TFormValues = Partial<TEntity>> {
  // ============================================================================
  // METADATA
  // ============================================================================

  /** Unique entity identifier (lowercase, singular) */
  entityName: string

  /** Display name (singular) */
  singularName: string

  /** Display name (plural) */
  pluralName: string

  /** Icon component */
  icon: LucideIcon

  /** Service instance */
  service: {
    getList: (params?: CRUDListParams) => Promise<Page<TEntity>>
    getById: (id: string | number) => Promise<TEntity>
    /**
     * create and update intentionally use `any` here.
     *
     * Rationale: The EntityConfig registry holds services for 51+ entities, each with
     * a different payload type (OrderFormValues, AreaFormValues, etc.). The config-driven
     * engine calls these through transformCreatePayload / transformUpdatePayload which
     * handle the type mapping. Using a concrete type here would require every service
     * to match the same signature, which defeats the purpose of the generic registry.
     *
     * The actual type safety lives in each domain's .service.ts and .zod.ts files.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (data: any) => Promise<TEntity>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: (id: string | number, data: any) => Promise<TEntity>
    delete: (id: string | number) => Promise<void>
    autocomplete?: (params?: Record<string, unknown>) => Promise<TEntity[]>
  }

  // ============================================================================
  // LIST PAGE CONFIGURATION
  // ============================================================================

  /** Column definitions for list view */
  listColumns: ColumnMetadata<TEntity>[]

  /** Default sort configuration */
  defaultSort?: SortConfig<TEntity>

  /** Fields to search across */
  searchFields?: (keyof TEntity | string)[]

  /** Default page size */
  defaultPageSize?: number

  /**
   * Override the ABP search query-param name. Defaults to "Term" (entity
   * endpoints); the Role endpoint uses "Filter".
   */
  searchParam?: string

  /** Filter field configurations */
  filterFields?: FilterField[]

  /** Custom list actions */
  customListActions?: React.ReactNode

  /** Render an expandable sub-component under each row (for nested data) */
  renderSubComponent?: (row: TEntity) => React.ReactNode

  /** Tree view configuration (for hierarchical entities) */
  treeConfig?: {
    parentIdField: string
    labelField: string
    orderField?: string
    iconField?: string
    initialExpanded?: boolean
  }

  // ============================================================================
  // DETAIL PAGE CONFIGURATION
  // ============================================================================

  /** Section definitions for detail view (can use ID strings from SectionRegistry) */
  detailSections: (DetailSection | string)[]

  /** Custom detail sections */
  customDetailSections?: React.ReactNode | ((entity: TEntity) => React.ReactNode)

  // ============================================================================
  // FORM CONFIGURATION
  // ============================================================================

  /** Form field configurations */
  formFields: Record<string, FormFieldConfig>

  /** Field rendering order */
  formFieldOrder: string[]

  /** Fields to exclude from form */
  excludeFields?: string[]

  /** Zod schema factory for create */
  createSchema: (t: (key: string, vars?: Record<string, unknown>) => string) => ZodSchema<TFormValues>

  /** Zod schema factory for update */
  updateSchema: (t: (key: string, vars?: Record<string, unknown>) => string) => ZodSchema<TFormValues>

  /** Default form values for create */
  defaultFormValues: TFormValues

  /** Optional custom form layout configuration */
  formLayout?:
    | {
        type: "split"
        leftFields: string[] // Field names for left column
        rightFields: string[] // Field names for right column
        leftWidth?: string // Default: "30%"
        rightWidth?: string // Default: "70%"
        gap?: string // Default: "1.5rem"
      }
    | {
        type: "grid"
        columns?: 1 | 2 | 3 | 4
        gap?: string
      }
    | {
        type: "sections"
        sections: {
          id: string
          title?: string
          titleKey?: string
          description?: string
          icon?: LucideIcon
          fields: string[] // Field names for this section
          columns?: 1 | 2 | 3 | 4
          className?: string
        }[]
        gap?: string
      }
    | {
        type: "tabs"
        tabs: {
          id: string
          title?: string
          titleKey?: string
          icon?: LucideIcon
          fields?: string[] // Field names for this tab (if not using rows)
          rows?: Array<{
            id: string
            title?: string
            titleKey?: string
            icon?: LucideIcon
            fields: string[] // Field names for this row/section
            columns?: 1 | 2 | 3 | 4 | 6 | 12
            className?: string
            gap?: string
          }>
          columns?: 1 | 2 | 3 | 4
          className?: string
        }[]
        gap?: string
      }
    | {
        type: "composition"
        rows: Array<{
          id: string
          title?: string
          titleKey?: string
          icon?: LucideIcon
          fields: string[] // Field names for this row/section
          columns?: 1 | 2 | 3 | 4 | 6 | 12
          className?: string
          gap?: string
        }>
        gap?: string
      }

  // ============================================================================
  // TRANSFORMATION FUNCTIONS
  // ============================================================================

  /** Transform entity to form data (for edit) */
  entityToFormData?: (entity: TEntity) => TFormValues

  /** Transform form data to create payload */
  transformCreatePayload?: (formData: TFormValues) => Partial<TEntity>

  /** Transform form data to update payload */
  transformUpdatePayload?: (formData: TFormValues, originalEntity: TEntity | null) => Partial<TEntity>

  // ============================================================================
  // TRANSLATION KEYS
  // ============================================================================

  /** Translation key mappings */
  translations: EntityTranslations

  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================

  /** Feature availability */
  features?: EntityFeatures

  // ============================================================================
  // PERMISSIONS
  // ============================================================================

  /**
   * ABP permission key prefix for this entity.
   *
   * Used to derive CRUD permissions automatically:
   *   View   → `permissionKey`              (e.g. "Api.Brand")
   *   Create → `permissionKey` + ".Create"  (e.g. "Api.Brand.Create")
   *   Update → `permissionKey` + ".Update"  (e.g. "Api.Brand.Update")
   *   Delete → `permissionKey` + ".Delete"  (e.g. "Api.Brand.Delete")
   *
   * For ABP Identity entities use the full key (e.g. "AbpIdentity.Roles").
   */
  permissionKey?: string

  // ============================================================================
  // ROUTING
  // ============================================================================

  /** Base route path (defaults to `/${entityName}`) */
  basePath?: string

  /** Custom route overrides */
  routes?: {
    list?: string
    detail?: string
    create?: string
    edit?: string
  }
}

/**
 * Entity configuration registry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EntityConfigRegistry = Record<string, EntityConfig<any, any>>

/**
 * Config validation result
 */
export interface ConfigValidationResult {
  valid: boolean
  entityName: string
  errors: string[]
  warnings: string[]
}
