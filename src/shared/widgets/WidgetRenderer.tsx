"use client"

/**
 * Generic widget renderer — single component that can mount any widget
 * defined by a WidgetBuilderSchema. Today it drives the widget wizard's
 * preview pane (with mock or live-fetched data); it's written to also back
 * a live dashboard canvas once that surface lands, where data fetching
 * would be driven by the widget's refresh policy.
 *
 * Rendering is dispatched on visualization.type. Every visual variant is
 * a small inline component so dropping in a new variant only adds one
 * branch — no router, no factory, no plugin layer. Note: the `map` variant
 * renders a marker-count preview, not a live map (see MapBody) — wiring the
 * real map provider into a widget cell is a follow-up.
 */

import { useMemo } from "react"
import nextDynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { cn } from "@/shared/utils"
import type { WidgetBuilderSchema } from "@/shared/widgets/schema"

// recharts ships ~85 KB gz; loading it dynamically means non-chart widgets
// (KPI, table, alert, map) never pay for it. The skeleton keeps the layout
// stable while the chunk arrives.
const ChartBody = nextDynamic(() => import("./ChartBody"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted/40 animate-pulse rounded" />,
})

type Row = Record<string, unknown>

interface WidgetRendererProps {
  schema: WidgetBuilderSchema
  /** Pre-fetched rows. The canvas / preview owns fetching. */
  data: Row[] | null
  loading?: boolean
  error?: string | null
  className?: string
}

export function WidgetRenderer({ schema, data, loading, error, className }: WidgetRendererProps): React.ReactNode {
  const t = useTranslations()
  // Resolve title via i18n; fall back to the raw key so unmapped widgets
  // still render something readable in dev.
  const title = useMemo(() => safeTranslate(t, schema.titleKey), [t, schema.titleKey])

  return (
    <div
      className={cn(
        "h-full w-full rounded-2xl border border-border bg-card/50 backdrop-blur-sm flex flex-col",
        className,
      )}
    >
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/60">
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{schema.category}</span>
      </header>
      <div className="flex-1 min-h-0 p-3">
        {error ? (
          <ErrorState message={error} />
        ) : loading || data === null ? (
          <LoadingState />
        ) : (
          <Body schema={schema} data={data} />
        )}
      </div>
    </div>
  )
}

function safeTranslate(t: ReturnType<typeof useTranslations>, key: string): string {
  try {
    const v = t(key as never)
    return typeof v === "string" ? v : key
  } catch {
    return key
  }
}

function Body({ schema, data }: { schema: WidgetBuilderSchema; data: Row[] }): React.ReactNode {
  const v = schema.visualization
  switch (v.type) {
    case "kpi":
      return <KpiBody visualization={v} data={data} />
    case "chart":
      return <ChartBody visualization={v} data={data} />
    case "table":
      return <TableBody visualization={v} data={data} />
    case "alert":
      return <AlertBody visualization={v} data={data} />
    case "map":
      return <MapBody visualization={v} data={data} />
  }
}

function KpiBody({
  visualization,
  data,
}: {
  visualization: Extract<WidgetBuilderSchema["visualization"], { type: "kpi" }>
  data: Row[]
}) {
  const first = data[0] ?? {}
  const raw = first[visualization.valueField]
  const trend = visualization.trendField ? first[visualization.trendField] : undefined
  const value = typeof raw === "number" ? raw.toLocaleString() : String(raw ?? "—")
  const accent = visualization.accentColor ?? "var(--primary)"

  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-baseline gap-1 text-3xl font-bold" style={{ color: accent }}>
        {visualization.prefix && <span className="text-base font-semibold opacity-70">{visualization.prefix}</span>}
        <span>{value}</span>
        {visualization.suffix && <span className="text-base font-semibold opacity-70">{visualization.suffix}</span>}
      </div>
      {trend !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">
          trend: {typeof trend === "number" ? trend.toLocaleString() : String(trend)}
        </p>
      )}
    </div>
  )
}

function TableBody({
  visualization,
  data,
}: {
  visualization: Extract<WidgetBuilderSchema["visualization"], { type: "table" }>
  data: Row[]
}) {
  const t = useTranslations("common")
  const rows = data.slice(0, visualization.pageSize)
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 sticky top-0">
          <tr>
            {visualization.columns.map(c => (
              <th key={c.field} className={`p-2 font-medium text-${c.align ?? "start"}`}>
                {c.label?.en ?? c.field}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/40">
              {visualization.columns.map(c => {
                const v = row[c.field]
                return (
                  <td key={c.field} className={`p-2 text-${c.align ?? "start"}`}>
                    {formatCell(v, c.format)}
                  </td>
                )
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={visualization.columns.length} className="p-4 text-center text-muted-foreground">
                {t("no_data")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function AlertBody({
  visualization,
  data,
}: {
  visualization: Extract<WidgetBuilderSchema["visualization"], { type: "alert" }>
  data: Row[]
}) {
  const t = useTranslations("common")
  const rows = data
  if (rows.length === 0 && visualization.hideWhenEmpty) {
    return <p className="text-xs text-muted-foreground">{t("no_alerts")}</p>
  }
  const palette: Record<typeof visualization.severity, string> = {
    info: "border-primary/40 bg-primary/10 text-primary",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  }
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <li key={i} className={cn("text-xs rounded-md border px-2 py-1", palette[visualization.severity])}>
          {String(r[visualization.messageField] ?? "—")}
        </li>
      ))}
    </ul>
  )
}

function MapBody({
  visualization,
  data,
}: {
  visualization: Extract<WidgetBuilderSchema["visualization"], { type: "map" }>
  data: Row[]
}) {
  // A live map (LeafletMapProvider) pulls in the map runtime + tiles, which
  // is heavy for a single grid cell. Until a widget cell can defer that, we
  // render an explicit *preview*: the marker count + configured zoom, clearly
  // labelled so it never reads as a map that failed to load.
  const valid = data.filter(r => {
    const pos = r[visualization.positionField]
    return pos && typeof pos === "object" && typeof (pos as { lat?: unknown }).lat === "number"
  })
  return (
    <div className="h-full w-full rounded-md border border-dashed border-border flex flex-col items-center justify-center text-xs text-muted-foreground">
      <span className="font-medium">Map preview</span>
      <span>
        {valid.length} markers · zoom {visualization.defaultZoom}
      </span>
    </div>
  )
}

function formatCell(v: unknown, format?: string): React.ReactNode {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>
  if (format === "badge") {
    return <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{String(v)}</span>
  }
  if (format === "currency" && typeof v === "number") {
    return v.toLocaleString(undefined, { style: "currency", currency: "USD" })
  }
  if (format === "number" && typeof v === "number") return v.toLocaleString()
  if (format === "date" && (typeof v === "string" || typeof v === "number")) {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString()
  }
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

function LoadingState() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-destructive text-center px-2">
      {message}
    </div>
  )
}
