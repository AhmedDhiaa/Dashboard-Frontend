/**
 * Page Builder block schema (per spec §3).
 *
 * Defines the discriminated union `blockSchema` covering 17 block kinds:
 *
 *   Content : heading, text, divider, spacer
 *   Layout  : card, tabs, accordion, grid          (recursive — contain blocks)
 *   Data    : table, form, detail, kpi, chart, alert, map
 *   Action  : button
 *   Custom  : custom (escape hatch)
 *
 * Also exports the supporting building blocks needed only here:
 *   - `dataSourceSchema`     (api / entity / swagger)
 *   - `formLayoutSchema`     (recursive: grid / tabs / sections / split)
 *   - `columnSchema`         (Page Builder column-type vocabulary, 18 values)
 *
 * Cycle note: `actionSchema` and `buttonSchema` live in ./action-schema and
 * THAT file imports `blockSchema` from this one (for dialog/drawer actions
 * whose body is a list of blocks). All cross-file references in either
 * direction go through `z.lazy(...)` so module init order is irrelevant.
 */

import { z } from "zod"
import { fieldSchema, localizedStringSchema, kebabIdSchema, fieldNameSchema, permissionKeySchema } from "./field-schema"
// Intentional cycle with ./action-schema, mediated by z.lazy() at every cross-file ref. See header note.
import { actionSchema, buttonSchema } from "./action-schema"
import type { MasterColumnType } from "@/core/entities/column-types"

// ─── Page Builder column-type vocabulary ────────────────────────────────────
//
// 18 column types from spec §3. `satisfies readonly MasterColumnType[]`
// keeps this list in lockstep with the master union. Drift = compile error.

export const PAGE_BUILDER_COLUMN_TYPES = [
  "text-primary",
  "text-secondary",
  "badge-code",
  "badge-status",
  "badge-count",
  "enum",
  "boolean",
  "datetime",
  "date",
  "time",
  "currency",
  "percentage",
  "number",
  "image-thumbnail",
  "avatar",
  "user-cell",
  "entity-link",
  "custom",
] as const satisfies readonly MasterColumnType[]

// ─── Data sources (api / entity / swagger) ──────────────────────────────────

const apiCallSourceSchema = z.object({
  type: z.literal("api"),
  endpoint: z.string().regex(/^\/[a-zA-Z0-9/_{}-]+$/, "endpoint must look like an API path"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  itemsPath: z.string().optional().default("items"),
  totalCountPath: z.string().optional().default("totalCount"),
  pathParams: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.unknown()).optional(),
})

const entitySourceSchema = z.object({
  type: z.literal("entity"),
  entityName: kebabIdSchema,
  filter: z.record(z.string(), z.unknown()).optional(),
})

const swaggerSourceSchema = z.object({
  type: z.literal("swagger"),
  swaggerUrl: z.url(),
  operationId: z.string().min(1),
})

export const dataSourceSchema = z.discriminatedUnion("type", [
  apiCallSourceSchema,
  entitySourceSchema,
  swaggerSourceSchema,
])
export type DataSource = z.infer<typeof dataSourceSchema>

// ─── Form layouts (recursive) ───────────────────────────────────────────────
//
// Tabs / sections / split layouts contain a nested layout, so the union must
// reference itself. `formLayoutSchema` is annotated `z.ZodType` to break the
// circular type inference, and the inner refs go through `z.lazy()`.

const gridFormLayoutSchema = z.object({
  type: z.literal("grid"),
  rows: z.array(
    z.object({
      columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      fields: z.array(fieldNameSchema),
    }),
  ),
})

const tabsFormLayoutSchema = z.object({
  type: z.literal("tabs"),
  tabs: z.array(
    z.object({
      id: kebabIdSchema,
      title: localizedStringSchema,
      icon: z.string().optional(),
      layout: z.lazy(() => formLayoutSchema),
      permission: permissionKeySchema.optional(),
    }),
  ),
})

const sectionsFormLayoutSchema = z.object({
  type: z.literal("sections"),
  sections: z.array(
    z.object({
      id: kebabIdSchema,
      title: localizedStringSchema,
      icon: z.string().optional(),
      collapsible: z.boolean().default(false),
      defaultOpen: z.boolean().default(true),
      layout: z.lazy(() => formLayoutSchema),
    }),
  ),
})

const splitFormLayoutSchema = z.object({
  type: z.literal("split"),
  left: z.lazy(() => formLayoutSchema),
  right: z.lazy(() => formLayoutSchema),
  ratio: z.union([z.literal("50/50"), z.literal("60/40"), z.literal("70/30")]).default("50/50"),
})

/**
 * Recursive layout type — declared explicitly so consumers (form-block)
 * receive a discriminated union rather than `unknown`. Without the
 * `z.ZodType<FormLayout>` parameterisation, the lazy() refs above leave
 * the inferred type unresolved.
 */
export type FormLayout =
  | { type: "grid"; rows: { columns: 1 | 2 | 3 | 4; fields: string[] }[] }
  | {
      type: "tabs"
      tabs: {
        id: string
        title: { en: string; ar: string }
        icon?: string
        layout: FormLayout
        permission?: string
      }[]
    }
  | {
      type: "sections"
      sections: {
        id: string
        title: { en: string; ar: string }
        icon?: string
        collapsible: boolean
        defaultOpen: boolean
        layout: FormLayout
      }[]
    }
  | { type: "split"; left: FormLayout; right: FormLayout; ratio: "50/50" | "60/40" | "70/30" }

export const formLayoutSchema: z.ZodType<FormLayout> = z.discriminatedUnion("type", [
  gridFormLayoutSchema,
  tabsFormLayoutSchema,
  sectionsFormLayoutSchema,
  splitFormLayoutSchema,
])

// ─── Column ─────────────────────────────────────────────────────────────────

export const columnSchema = z.object({
  /** Dot-paths permitted, e.g. `"user.name"`. */
  field: z.string().min(1),
  type: z.enum(PAGE_BUILDER_COLUMN_TYPES),
  label: localizedStringSchema.optional(),
  width: z.union([z.number(), z.string()]).optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  sortable: z.boolean().default(true),
  filterable: z.boolean().default(false),
  hidden: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).optional(),
})

// ─── Block base props ───────────────────────────────────────────────────────

const baseBlockProps = {
  id: kebabIdSchema,
  hidden: z.boolean().default(false),
  permission: permissionKeySchema.optional(),
}

// ─── Content blocks ─────────────────────────────────────────────────────────

export const headingBlock = z.object({
  ...baseBlockProps,
  type: z.literal("heading"),
  text: localizedStringSchema,
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(2),
})

export const textBlock = z.object({
  ...baseBlockProps,
  type: z.literal("text"),
  text: localizedStringSchema,
  variant: z.enum(["body", "muted", "lead"]).default("body"),
})

export const dividerBlock = z.object({
  ...baseBlockProps,
  type: z.literal("divider"),
})

export const spacerBlock = z.object({
  ...baseBlockProps,
  type: z.literal("spacer"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
})

// ─── Layout blocks (recursive) ──────────────────────────────────────────────

export const cardBlock = z.object({
  ...baseBlockProps,
  type: z.literal("card"),
  title: localizedStringSchema.optional(),
  icon: z.string().optional(),
  blocks: z.lazy(() => z.array(blockSchema)),
})

export const tabsBlock = z.object({
  ...baseBlockProps,
  type: z.literal("tabs"),
  tabs: z.array(
    z.object({
      id: kebabIdSchema,
      label: localizedStringSchema,
      icon: z.string().optional(),
      permission: permissionKeySchema.optional(),
      blocks: z.lazy(() => z.array(blockSchema)),
    }),
  ),
})

export const accordionBlock = z.object({
  ...baseBlockProps,
  type: z.literal("accordion"),
  multiple: z.boolean().default(false),
  items: z.array(
    z.object({
      id: kebabIdSchema,
      title: localizedStringSchema,
      icon: z.string().optional(),
      blocks: z.lazy(() => z.array(blockSchema)),
    }),
  ),
})

export const gridBlock = z.object({
  ...baseBlockProps,
  type: z.literal("grid"),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  blocks: z.lazy(() => z.array(blockSchema)),
})

// ─── Data blocks ────────────────────────────────────────────────────────────

const tableFilterSchema = z.object({
  field: z.string().min(1),
  type: z.enum(["text", "select", "multi-select", "date-range", "boolean"]),
  label: localizedStringSchema,
  options: z
    .array(
      z.object({
        value: z.union([z.string(), z.number()]),
        label: localizedStringSchema,
      }),
    )
    .optional(),
})

export const tableBlock = z.object({
  ...baseBlockProps,
  type: z.literal("table"),
  dataSource: dataSourceSchema,
  columns: z.array(columnSchema),
  pageSize: z.number().int().positive().default(10),
  searchable: z.boolean().default(true),
  searchFields: z.array(z.string()).optional(),
  filters: z.array(tableFilterSchema).optional(),
  rowActions: z.array(z.lazy(() => buttonSchema)).optional(),
  bulkActions: z.array(z.lazy(() => buttonSchema)).optional(),
  defaultSort: z
    .object({
      field: z.string().min(1),
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),
  /** e.g. `"/orders/{id}"` — clicking the row navigates to this URL. */
  rowLink: z.string().optional(),
})

export const formBlock = z.object({
  ...baseBlockProps,
  type: z.literal("form"),
  /** Optional — present in edit mode, absent in create mode. */
  dataSource: dataSourceSchema.optional(),
  fields: z.array(fieldSchema),
  layout: formLayoutSchema,
  submitAction: z.lazy(() => actionSchema),
  cancelAction: z.lazy(() => actionSchema).optional(),
  resetButton: z.boolean().default(false),
  submitLabel: localizedStringSchema.optional(),
  cancelLabel: localizedStringSchema.optional(),
})

const detailFieldSchema = z.object({
  field: z.string().min(1),
  label: localizedStringSchema.optional(),
  type: z.enum(PAGE_BUILDER_COLUMN_TYPES).optional(),
})

export const detailBlock = z.object({
  ...baseBlockProps,
  type: z.literal("detail"),
  dataSource: dataSourceSchema,
  sections: z.array(
    z.object({
      id: kebabIdSchema,
      title: localizedStringSchema,
      icon: z.string().optional(),
      fields: z.array(detailFieldSchema),
    }),
  ),
})

export const kpiBlock = z.object({
  ...baseBlockProps,
  type: z.literal("kpi"),
  dataSource: dataSourceSchema,
  valueField: z.string().min(1),
  trendField: z.string().optional(),
  label: localizedStringSchema,
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  icon: z.string().optional(),
  accentColor: z.string().optional(),
})

export const chartBlock = z.object({
  ...baseBlockProps,
  type: z.literal("chart"),
  dataSource: dataSourceSchema,
  chartType: z.enum(["line", "bar", "pie", "area", "donut", "radar"]),
  xAxis: z
    .object({
      field: z.string().min(1),
      label: localizedStringSchema.optional(),
    })
    .optional(),
  yAxes: z
    .array(
      z.object({
        field: z.string().min(1),
        label: localizedStringSchema.optional(),
      }),
    )
    .min(1, "at least one Y-axis series required"),
  colors: z.array(z.string()).optional(),
  showLegend: z.boolean().default(true),
})

export const alertBlock = z.object({
  ...baseBlockProps,
  type: z.literal("alert"),
  severity: z.enum(["info", "success", "warning", "destructive"]),
  title: localizedStringSchema,
  message: localizedStringSchema.optional(),
  dismissible: z.boolean().default(false),
  dataSource: dataSourceSchema.optional(),
  hideWhenEmpty: z.boolean().default(true),
})

export const buttonBlock = z.object({
  ...baseBlockProps,
  type: z.literal("button"),
  button: z.lazy(() => buttonSchema),
})

export const mapBlock = z.object({
  ...baseBlockProps,
  type: z.literal("map"),
  dataSource: dataSourceSchema,
  centerField: z.string().optional(),
  features: z.object({
    markers: z.boolean().default(false),
    boundaries: z.boolean().default(false),
    drawing: z.boolean().default(false),
  }),
})

// ─── Custom block (escape hatch — registered component) ─────────────────────

const customBlock = z.object({
  ...baseBlockProps,
  type: z.literal("custom"),
  /** Must match a key in BlockRegistry. Identifier-shape kept loose on purpose
   *  so consumers can use any registered name. */
  componentName: z.string().min(1),
  props: z.record(z.string(), z.unknown()),
})

// ─── Block union ────────────────────────────────────────────────────────────

export const blockSchema: z.ZodType = z.discriminatedUnion("type", [
  headingBlock,
  textBlock,
  dividerBlock,
  spacerBlock,
  cardBlock,
  tabsBlock,
  accordionBlock,
  gridBlock,
  tableBlock,
  formBlock,
  detailBlock,
  kpiBlock,
  chartBlock,
  alertBlock,
  buttonBlock,
  mapBlock,
  customBlock,
])
export type BlockSchema = z.infer<typeof blockSchema>
