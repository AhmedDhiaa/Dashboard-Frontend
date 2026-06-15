"use client"

/**
 * Shared bits for the Step3Visualization wizard step:
 *
 *   - The `Form` discriminated union driving the UI per category.
 *   - Defaults + merge helpers that bridge `WidgetDraft` ↔ `Form`.
 *   - `buildVisualization` / `collectErrors` (used by the orchestrator).
 *   - Cross-category UI bits: `Field`, `ColorTokenSelect`, `LayoutForm`.
 *
 * Each category-specific sub-form (Kpi/Chart/Table/Alert/Map) lives in its
 * own `Step3.<Category>Config.tsx` file and consumes these helpers.
 */

import { Input } from "@/ui/design-system/primitives/input"
import type { WidgetDraft } from "./useWidgetWizardState"
import type { Visualization } from "../types/widget-schema"

// ─── Tokens ────────────────────────────────────────────────────────────────

export const DEFAULT_TOKENS = [
  "var(--primary)",
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
  "var(--muted-foreground)",
] as const

// ─── Form discriminated union ──────────────────────────────────────────────

export type ChartType = "line" | "bar" | "pie" | "area" | "donut"

export interface SharedForm {
  layoutW: number
  layoutH: number
}

export interface KpiForm extends SharedForm {
  type: "kpi"
  valueField: string
  trendField: string
  prefix: string
  suffix: string
  accentColor: string
  icon: string
}

export interface ChartForm extends SharedForm {
  type: "chart"
  chartType: ChartType
  xField: string
  xFormat: string
  yAxes: { field: string; label: string; format: string }[]
  colors: string[]
  showLegend: boolean
  stacked: boolean
}

export interface TableForm extends SharedForm {
  type: "table"
  columns: { field: string; label: string; align: "" | "start" | "center" | "end"; format: string }[]
  pageSize: number
}

export interface AlertForm extends SharedForm {
  type: "alert"
  severity: "info" | "success" | "warning" | "destructive"
  messageField: string
  hideWhenEmpty: boolean
}

export interface MapForm extends SharedForm {
  type: "map"
  positionField: string
  popupField: string
  defaultZoom: number
}

export type Form = KpiForm | ChartForm | TableForm | AlertForm | MapForm

// ─── Defaults ──────────────────────────────────────────────────────────────

const SHARED_DEFAULT: SharedForm = { layoutW: 4, layoutH: 2 }

export function defaultForCategory(category: WidgetDraft["category"]): Form {
  switch (category) {
    case "chart":
      return {
        ...SHARED_DEFAULT,
        layoutW: 6,
        layoutH: 4,
        type: "chart",
        chartType: "bar",
        xField: "",
        xFormat: "",
        yAxes: [{ field: "", label: "", format: "" }],
        colors: ["var(--primary)"],
        showLegend: true,
        stacked: false,
      }
    case "table":
      return {
        ...SHARED_DEFAULT,
        layoutW: 6,
        layoutH: 3,
        type: "table",
        columns: [{ field: "", label: "", align: "", format: "" }],
        pageSize: 10,
      }
    case "alert":
      return {
        ...SHARED_DEFAULT,
        layoutW: 12,
        layoutH: 1,
        type: "alert",
        severity: "info",
        messageField: "",
        hideWhenEmpty: true,
      }
    case "map":
      return {
        ...SHARED_DEFAULT,
        layoutW: 8,
        layoutH: 5,
        type: "map",
        positionField: "",
        popupField: "",
        defaultZoom: 10,
      }
    default:
      return {
        ...SHARED_DEFAULT,
        layoutW: 3,
        layoutH: 2,
        type: "kpi",
        valueField: "",
        trendField: "",
        prefix: "",
        suffix: "",
        accentColor: "var(--primary)",
        icon: "",
      }
  }
}

// ─── Draft → Form merge ────────────────────────────────────────────────────

export function fromDraft(d: WidgetDraft): Form {
  const base = defaultForCategory(d.category ?? "kpi")
  if (d.layout) {
    base.layoutW = d.layout.w
    base.layoutH = d.layout.h
  }
  const v = d.visualization
  if (!v) return base
  return mergeVisualization(base, v)
}

function mergeVisualization(base: Form, v: Visualization): Form {
  switch (v.type) {
    case "kpi":
      return mergeKpi(base as KpiForm, v)
    case "chart":
      return mergeChart(base as ChartForm, v)
    case "table":
      return mergeTable(base as TableForm, v)
    case "alert":
      return mergeAlert(base as AlertForm, v)
    case "map":
      return mergeMap(base as MapForm, v)
  }
}

function mergeKpi(base: KpiForm, v: Extract<Visualization, { type: "kpi" }>): KpiForm {
  return {
    ...base,
    type: "kpi",
    valueField: v.valueField,
    trendField: v.trendField ?? "",
    prefix: v.prefix ?? "",
    suffix: v.suffix ?? "",
    accentColor: v.accentColor ?? "var(--primary)",
    icon: v.icon ?? "",
  }
}

function mergeChart(base: ChartForm, v: Extract<Visualization, { type: "chart" }>): ChartForm {
  return {
    ...base,
    type: "chart",
    chartType: v.chartType,
    xField: v.xAxis?.field ?? "",
    xFormat: v.xAxis?.format ?? "",
    yAxes: v.yAxes.map(y => ({ field: y.field, label: y.label?.en ?? "", format: y.format ?? "" })),
    colors: v.colors ?? ["var(--primary)"],
    showLegend: v.showLegend,
    stacked: v.stacked,
  }
}

function mergeTable(base: TableForm, v: Extract<Visualization, { type: "table" }>): TableForm {
  return {
    ...base,
    type: "table",
    columns: v.columns.map(c => ({
      field: c.field,
      label: c.label?.en ?? "",
      align: c.align ?? "",
      format: c.format ?? "",
    })),
    pageSize: v.pageSize,
  }
}

function mergeAlert(base: AlertForm, v: Extract<Visualization, { type: "alert" }>): AlertForm {
  return {
    ...base,
    type: "alert",
    severity: v.severity,
    messageField: v.messageField,
    hideWhenEmpty: v.hideWhenEmpty,
  }
}

function mergeMap(base: MapForm, v: Extract<Visualization, { type: "map" }>): MapForm {
  return {
    ...base,
    type: "map",
    positionField: v.positionField,
    popupField: v.popupField ?? "",
    defaultZoom: v.defaultZoom,
  }
}

// ─── Form → Visualization (output) ─────────────────────────────────────────

export function buildVisualization(form: Form): Visualization {
  switch (form.type) {
    case "kpi":
      return {
        type: "kpi",
        valueField: form.valueField,
        ...(form.trendField ? { trendField: form.trendField } : {}),
        ...(form.prefix ? { prefix: form.prefix } : {}),
        ...(form.suffix ? { suffix: form.suffix } : {}),
        ...(form.accentColor ? { accentColor: form.accentColor } : {}),
        ...(form.icon ? { icon: form.icon } : {}),
      }
    case "chart":
      return {
        type: "chart",
        chartType: form.chartType,
        ...(form.xField
          ? { xAxis: { field: form.xField, ...(form.xFormat ? { format: form.xFormat as never } : {}) } }
          : {}),
        yAxes: form.yAxes.map(y => ({
          field: y.field,
          ...(y.label ? { label: { en: y.label, ar: y.label } } : {}),
          ...(y.format ? { format: y.format as never } : {}),
        })),
        colors: form.colors,
        showLegend: form.showLegend,
        stacked: form.stacked,
      }
    case "table":
      return {
        type: "table",
        columns: form.columns.map(c => ({
          field: c.field,
          ...(c.label ? { label: { en: c.label, ar: c.label } } : {}),
          ...(c.align ? { align: c.align } : {}),
          ...(c.format ? { format: c.format as never } : {}),
        })),
        pageSize: form.pageSize,
      }
    case "alert":
      return {
        type: "alert",
        severity: form.severity,
        messageField: form.messageField,
        hideWhenEmpty: form.hideWhenEmpty,
      }
    case "map":
      return {
        type: "map",
        positionField: form.positionField,
        ...(form.popupField ? { popupField: form.popupField } : {}),
        defaultZoom: form.defaultZoom,
      }
  }
}

// ─── Validation ────────────────────────────────────────────────────────────

export function collectErrors(form: Form): Record<string, string> {
  const e: Record<string, string> = {}
  switch (form.type) {
    case "kpi":
      if (!form.valueField) e.valueField = "Required"
      break
    case "chart":
      if (form.yAxes.length === 0) e.yAxes = "At least one series required"
      else if (form.yAxes.some(y => !y.field)) e.yAxes = "Every series needs a field"
      break
    case "table":
      if (form.columns.length === 0) e.columns = "At least one column required"
      else if (form.columns.some(c => !c.field)) e.columns = "Every column needs a field"
      break
    case "alert":
      if (!form.messageField) e.messageField = "Required"
      break
    case "map":
      if (!form.positionField) e.positionField = "Required"
      break
  }
  return e
}

// ─── Cross-category UI primitives ──────────────────────────────────────────

export function ColorTokenSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {DEFAULT_TOKENS.map(t => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium block">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function LayoutForm({ form, setForm }: { form: Form; setForm: React.Dispatch<React.SetStateAction<Form>> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
      <Field label="Width (1–12 cols)">
        <Input
          type="number"
          min={1}
          max={12}
          value={form.layoutW}
          onChange={e => setForm(prev => ({ ...prev, layoutW: Math.min(12, Math.max(1, Number(e.target.value))) }))}
        />
      </Field>
      <Field label="Height (1–8 rows)">
        <Input
          type="number"
          min={1}
          max={8}
          value={form.layoutH}
          onChange={e => setForm(prev => ({ ...prev, layoutH: Math.min(8, Math.max(1, Number(e.target.value))) }))}
        />
      </Field>
    </div>
  )
}
