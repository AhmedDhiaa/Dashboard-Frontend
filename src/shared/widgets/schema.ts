/**
 * WidgetBuilderSchema — single source of truth for a dashboard widget.
 *
 * Same SSOT contract as EntityBuilderSchema (Task 14): one Zod schema
 * defines both the runtime validator and the static TS type. Used by:
 *   - the wizard's preview pane
 *   - the save endpoint that emits `<id>.widget.ts`
 *   - the dashboard canvas that mounts widget instances
 *
 * Covers: KPI cards, line/bar/pie/area charts, data tables, alert banners,
 * and map widgets. Each visualization variant is a discriminated union
 * member so type-specific config is type-checked at the call site.
 */

import { z } from "zod"

// ─── Common bits ────────────────────────────────────────────────────────────

const localisedStringSchema = z.object({
  en: z.string(),
  ar: z.string(),
})
/** @public Contract type re-used by widget config builders downstream. */
export type LocalisedString = z.infer<typeof localisedStringSchema>

const idSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, "id must be lowercase kebab-case starting with a letter")
const tokenColorSchema = z
  .string()
  .regex(/^var\(--[a-zA-Z0-9-]+\)$/, "color must be a CSS-variable token like var(--primary)")

// ─── Categories ─────────────────────────────────────────────────────────────

export const WIDGET_CATEGORIES = ["kpi", "chart", "table", "map", "alert"] as const
const widgetCategorySchema = z.enum(WIDGET_CATEGORIES)
export type WidgetCategory = z.infer<typeof widgetCategorySchema>

// ─── Data source ────────────────────────────────────────────────────────────

/**
 * @public Re-exported so the Page Builder schema can compose the same data-source
 * shape rather than duplicating it. Kept structurally identical to its widget
 * usage; the Page Builder discriminated-union extends this without rewriting it.
 */
export const entityListSourceSchema = z.object({
  type: z.literal("entity-list"),
  /** Entity name from the registry. Validated at registration time. */
  entityName: z.string().min(1),
  /** Optional client-side filters / aggregations. */
  filter: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).optional(),
  groupBy: z.string().optional(),
  /** For KPI/chart aggregations: which field to roll up. */
  aggregateField: z.string().optional(),
  aggregateOp: z.enum(["count", "sum", "avg", "min", "max"]).optional(),
})

/** @public See `entityListSourceSchema` rationale. */
export const apiCallSourceSchema = z.object({
  type: z.literal("api-call"),
  endpoint: z.string().min(1),
  method: z.enum(["GET", "POST"]).default("GET"),
  /** Path inside the response payload to the array / value (default: 'items'). */
  itemsPath: z.string().default("items"),
  /** Headers / body for POST; admins compose them in the wizard. */
  body: z.record(z.string(), z.unknown()).optional(),
})

/** @public See `entityListSourceSchema` rationale. */
export const dataSourceSchema = z.discriminatedUnion("type", [entityListSourceSchema, apiCallSourceSchema])
export type DataSource = z.infer<typeof dataSourceSchema>

// ─── Visualization variants ─────────────────────────────────────────────────

/** @public Re-exported for Page Builder reuse. */
export const axisSchema = z.object({
  field: z.string().min(1),
  label: localisedStringSchema.optional(),
  /** Override the inferred numeric/categorical formatting. */
  format: z.enum(["number", "currency", "percentage", "date", "datetime", "text"]).optional(),
})

/** @public Re-exported for Page Builder reuse. */
export const kpiVisualSchema = z.object({
  type: z.literal("kpi"),
  /** Numeric value displayed prominently. References a field on the source. */
  valueField: z.string().min(1),
  /** Optional secondary metric (e.g. "+12% vs last week"). */
  trendField: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  accentColor: tokenColorSchema.optional(),
  icon: z.string().optional(),
})

/** @public Re-exported for Page Builder reuse. */
export const chartVisualSchema = z.object({
  type: z.literal("chart"),
  chartType: z.enum(["line", "bar", "pie", "area", "donut"]),
  xAxis: axisSchema.optional(),
  yAxes: z.array(axisSchema).min(1, "at least one Y-axis series required"),
  /** Series colors as design tokens (one per Y-axis entry). */
  colors: z.array(tokenColorSchema).optional(),
  showLegend: z.boolean().default(true),
  stacked: z.boolean().default(false),
})

/** @public Re-exported for Page Builder reuse. */
export const tableVisualSchema = z.object({
  type: z.literal("table"),
  columns: z
    .array(
      z.object({
        field: z.string().min(1),
        label: localisedStringSchema.optional(),
        align: z.enum(["start", "center", "end"]).optional(),
        format: z.enum(["text", "number", "currency", "date", "badge"]).optional(),
      }),
    )
    .min(1),
  pageSize: z.number().int().positive().default(10),
})

/** @public Re-exported for Page Builder reuse. */
export const alertVisualSchema = z.object({
  type: z.literal("alert"),
  severity: z.enum(["info", "success", "warning", "destructive"]),
  /** Field on the source whose value drives the body text. */
  messageField: z.string().min(1),
  /** Hide the widget entirely if the source returns an empty list. */
  hideWhenEmpty: z.boolean().default(true),
})

/** @public Re-exported for Page Builder reuse. */
export const mapVisualSchema = z.object({
  type: z.literal("map"),
  /** Field producing { lat, lng } for each marker. */
  positionField: z.string().min(1),
  popupField: z.string().optional(),
  defaultZoom: z.number().int().min(1).max(20).default(10),
})

/** @public Re-exported so the Page Builder can reuse the same visualization union. */
export const visualizationSchema = z.discriminatedUnion("type", [
  kpiVisualSchema,
  chartVisualSchema,
  tableVisualSchema,
  alertVisualSchema,
  mapVisualSchema,
])
export type Visualization = z.infer<typeof visualizationSchema>

// ─── Refresh policy ────────────────────────────────────────────────────────

const refreshSchema = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("manual") }),
    z.object({
      mode: z.literal("interval"),
      intervalMs: z.number().int().min(1000, "interval must be ≥ 1 second"),
    }),
    z.object({
      mode: z.literal("socket"),
      topic: z.string().min(1),
    }),
  ])
  .default({ mode: "manual" })
export type RefreshPolicy = z.infer<typeof refreshSchema>

// ─── Layout footprint ──────────────────────────────────────────────────────

/** @public Re-exported so the Page Builder can describe a widget's footprint identically. */
export const layoutSchema = z.object({
  /** Width in 12-column grid units. */
  w: z.number().int().min(1).max(12),
  /** Height in row units (1 row ≈ 60px). */
  h: z.number().int().min(1).max(8),
})

// ─── Top-level schema ──────────────────────────────────────────────────────

export const widgetBuilderSchema = z
  .object({
    id: idSchema,
    titleKey: z.string().min(1, "translation key required"),
    category: widgetCategorySchema,
    dataSource: dataSourceSchema,
    visualization: visualizationSchema,
    refresh: refreshSchema,
    layout: layoutSchema,
    permissionKey: z.string().regex(/^[A-Z][A-Za-z0-9.]*$/, "permissionKey conventionally PascalCase with dots"),
  })
  // Cross-field hygiene: socket refresh + non-streaming source is suspect;
  // chart visualizations with an api-call source need a known itemsPath.
  .superRefine((widget, ctx) => {
    if (widget.refresh.mode === "socket" && widget.dataSource.type !== "api-call") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refresh", "topic"],
        message: "socket refresh expects an api-call data source carrying the topic stream",
      })
    }
    // Category should agree with the visualization type — a "kpi" widget
    // shouldn't carry a chart visualization, etc.
    const expectedCategoryFor: Record<Visualization["type"], WidgetCategory> = {
      kpi: "kpi",
      chart: "chart",
      table: "table",
      alert: "alert",
      map: "map",
    }
    if (expectedCategoryFor[widget.visualization.type] !== widget.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: `category '${widget.category}' does not match visualization '${widget.visualization.type}'`,
      })
    }
  })

export type WidgetBuilderSchema = z.infer<typeof widgetBuilderSchema>
