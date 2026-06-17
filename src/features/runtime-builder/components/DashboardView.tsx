"use client"

/**
 * DashboardView — renders a runtime dashboard from config + live data.
 *
 * Each widget reads from useRuntimeList() for the bound entity, so any
 * record CRUD elsewhere (or a different tab) updates the dashboard live.
 */

import { useMemo } from "react"
import dynamic from "next/dynamic"
import type { RuntimeEntity, RuntimeRecord, RuntimeWidget } from "../types"
import { useRuntimeConfig, useRuntimeList } from "../store"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/design-system/primitives/table"

// Recharts (~85 KB gz) is dynamic-imported so it stays out of this route's
// first-load bundle and never runs on the server. KPI/table widgets never
// trigger the chunk.
const DashboardChartBody = dynamic(() => import("./DashboardChartBody"), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-md bg-muted" />,
})

export function DashboardView({ dashboardId }: { dashboardId: string }) {
  const config = useRuntimeConfig()
  const dashboard = config.dashboards.find(d => d.id === dashboardId)

  if (!dashboard) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Dashboard not found.</p>
  }

  if (dashboard.widgets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        This dashboard is empty. Add widgets in the builder.
      </p>
    )
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
      {dashboard.widgets.map(w => {
        const entity = config.entities.find(e => e.id === w.entityId)
        return (
          <div key={w.id} style={{ gridColumn: `span ${Math.min(4, Math.max(1, w.span ?? 1))}` }}>
            <WidgetView widget={w} entity={entity} />
          </div>
        )
      })}
    </div>
  )
}

function WidgetView({ widget, entity }: { widget: RuntimeWidget; entity: RuntimeEntity | undefined }) {
  if (!entity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No data source bound — pick an entity in the builder.
        </CardContent>
      </Card>
    )
  }
  switch (widget.kind) {
    case "stat":
      return <StatWidget widget={widget} entity={entity} />
    case "table":
      return <TableWidget widget={widget} entity={entity} />
    case "chart":
      return <ChartWidget widget={widget} entity={entity} />
    default:
      return null
  }
}

function aggregate(records: RuntimeRecord[], aggregation: string, fieldKey?: string): number {
  if (aggregation === "count") return records.length
  if (!fieldKey) return 0
  const values = records.map(r => Number(r[fieldKey])).filter(n => !Number.isNaN(n))
  if (values.length === 0) return 0
  switch (aggregation) {
    case "sum":
      return values.reduce((a, b) => a + b, 0)
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length
    case "min":
      return Math.min(...values)
    case "max":
      return Math.max(...values)
    default:
      return 0
  }
}

function StatWidget({ widget, entity }: { widget: RuntimeWidget; entity: RuntimeEntity }) {
  const { items } = useRuntimeList(entity.id)
  const value = useMemo(
    () => aggregate(items, widget.config?.aggregation ?? "count", widget.config?.field),
    [items, widget.config?.aggregation, widget.config?.field],
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {widget.config?.aggregation === "count"
            ? `Total ${entity.pluralName.toLowerCase()}`
            : `${widget.config?.aggregation} of ${widget.config?.field ?? "—"}`}
        </p>
      </CardContent>
    </Card>
  )
}

function TableWidget({ widget, entity }: { widget: RuntimeWidget; entity: RuntimeEntity }) {
  const { items } = useRuntimeList(entity.id, { pageSize: 10, page: 1 })
  const cols = useMemo(() => {
    if (widget.config?.columns && widget.config.columns.length > 0) {
      return widget.config.columns
        .map(key => entity.fields.find(f => f.key === key))
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
    }
    return entity.fields.slice(0, 4)
  }, [widget.config?.columns, entity.fields])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map(c => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols.length} className="text-center text-muted-foreground py-6">
                  No data
                </TableCell>
              </TableRow>
            ) : (
              items.map(row => (
                <TableRow key={row.id}>
                  {cols.map(c => (
                    <TableCell key={c.key}>
                      {row[c.key] == null || row[c.key] === "" ? "—" : String(row[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ChartWidget({ widget, entity }: { widget: RuntimeWidget; entity: RuntimeEntity }) {
  const { items } = useRuntimeList(entity.id, { pageSize: widget.config?.limit ?? 10, page: 1 })
  const titleField = entity.fields.find(f => f.isTitle)?.key ?? entity.fields[0]?.key ?? "id"
  const fieldKey = widget.config?.field

  const data = useMemo(() => {
    if (!fieldKey) return []
    return items.map(r => ({
      name: String(r[titleField] ?? r.id).slice(0, 20),
      value: Number(r[fieldKey]) || 0,
    }))
  }, [items, titleField, fieldKey])

  if (!fieldKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Pick a numeric field in the builder.</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: 220 }}>
          <DashboardChartBody data={data} chartType={widget.config?.chartType} />
        </div>
      </CardContent>
    </Card>
  )
}
