"use client"

/**
 * DashboardBuilder — create dashboards as ordered lists of widgets.
 *
 * Widgets are bound to entities by id. When the entity's data changes the
 * widgets re-render through the same provider subscription used by tables.
 */

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import type { RuntimeDashboard, RuntimeWidget, RuntimeWidgetKind } from "../types"
import { deleteDashboard, genId, upsertDashboard, useRuntimeConfig, useRuntimeProvider } from "../store"
import { Input } from "@/ui/design-system/primitives/input"
import { Button } from "@/ui/design-system/primitives/button"
import { Label } from "@/ui/design-system/primitives/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"

const WIDGET_KINDS: { value: RuntimeWidgetKind; label: string }[] = [
  { value: "stat", label: "Stat (single number)" },
  { value: "table", label: "Table (rows from entity)" },
  { value: "chart", label: "Chart (bar/line)" },
]

const AGGREGATIONS = [
  { value: "count", label: "Record count" },
  { value: "sum", label: "Sum of field" },
  { value: "avg", label: "Average of field" },
  { value: "min", label: "Min of field" },
  { value: "max", label: "Max of field" },
] as const

export function DashboardBuilder() {
  const provider = useRuntimeProvider()
  const config = useRuntimeConfig()
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleCreate = () => {
    const dash: RuntimeDashboard = { id: genId("dash"), title: "Untitled Dashboard", widgets: [] }
    upsertDashboard(provider, dash)
    setEditingId(dash.id)
  }

  const editing = config.dashboards.find(d => d.id === editingId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{config.dashboards.length} dashboard(s)</h3>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New dashboard
        </Button>
      </div>

      {config.dashboards.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
          No dashboards yet.
        </p>
      ) : (
        <div className="space-y-2">
          {config.dashboards.map(d => (
            <div key={d.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
              <Input
                value={d.title}
                onChange={e => upsertDashboard(provider, { ...d, title: e.target.value })}
                className="h-8 border-transparent bg-transparent hover:border-border"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{d.widgets.length} widget(s)</span>
              <Button variant="outline" size="sm" onClick={() => setEditingId(d.id)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteDashboard(provider, d.id)}
                aria-label="Delete dashboard"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {editing && <DashboardEditor dashboard={editing} onClose={() => setEditingId(null)} />}
    </div>
  )
}

interface DashboardEditorProps {
  dashboard: RuntimeDashboard
  onClose: () => void
}

function DashboardEditor({ dashboard, onClose }: DashboardEditorProps) {
  const provider = useRuntimeProvider()
  const config = useRuntimeConfig()

  // Re-read the freshest dashboard from config so live edits propagate
  const current = config.dashboards.find(d => d.id === dashboard.id) ?? dashboard

  const addWidget = () => {
    const w: RuntimeWidget = {
      id: genId("w"),
      kind: "stat",
      title: "New widget",
      config: { aggregation: "count" },
    }
    upsertDashboard(provider, { ...current, widgets: [...current.widgets, w] })
  }

  const updateWidget = (id: string, patch: Partial<RuntimeWidget>) => {
    upsertDashboard(provider, {
      ...current,
      widgets: current.widgets.map(w => (w.id === id ? { ...w, ...patch } : w)),
    })
  }

  const removeWidget = (id: string) => {
    upsertDashboard(provider, { ...current, widgets: current.widgets.filter(w => w.id !== id) })
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Editing: {current.title}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addWidget} className="gap-1">
            <Plus className="h-4 w-4" />
            Add widget
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {current.widgets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No widgets yet. Add one above.</p>
        ) : (
          current.widgets.map(w => (
            <WidgetEditor
              key={w.id}
              widget={w}
              entities={config.entities}
              onChange={patch => updateWidget(w.id, patch)}
              onRemove={() => removeWidget(w.id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

interface WidgetEditorProps {
  widget: RuntimeWidget
  entities: RuntimeConfigEntities
  onChange: (patch: Partial<RuntimeWidget>) => void
  onRemove: () => void
}
type RuntimeConfigEntities = ReturnType<typeof useRuntimeConfig>["entities"]

function WidgetEditor({ widget, entities, onChange, onRemove }: WidgetEditorProps) {
  const entity = entities.find(e => e.id === widget.entityId)
  const numericFields = entity?.fields.filter(f => f.type === "number") ?? []

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Input value={widget.title} onChange={e => onChange({ title: e.target.value })} placeholder="Widget title" />
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove widget">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <WidgetCommonFields widget={widget} entities={entities} onChange={onChange} />
      {widget.kind === "stat" && <StatWidgetFields widget={widget} numericFields={numericFields} onChange={onChange} />}
      {widget.kind === "chart" && (
        <ChartWidgetFields widget={widget} numericFields={numericFields} onChange={onChange} />
      )}
      {widget.kind === "table" && <TableWidgetFields widget={widget} onChange={onChange} />}
    </div>
  )
}

function WidgetCommonFields({
  widget,
  entities,
  onChange,
}: {
  widget: RuntimeWidget
  entities: RuntimeConfigEntities
  onChange: (patch: Partial<RuntimeWidget>) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="space-y-1">
        <Label>Kind</Label>
        <Select value={widget.kind} onValueChange={v => onChange({ kind: v as RuntimeWidgetKind })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WIDGET_KINDS.map(k => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Data source</Label>
        <Select value={widget.entityId ?? ""} onValueChange={v => onChange({ entityId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Pick an entity" />
          </SelectTrigger>
          <SelectContent>
            {entities.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.pluralName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Span (1-4)</Label>
        <Input
          type="number"
          min={1}
          max={4}
          value={widget.span ?? 1}
          onChange={e => onChange({ span: Math.max(1, Math.min(4, Number(e.target.value) || 1)) })}
        />
      </div>
    </div>
  )
}

type FieldList = { key: string; label: string }[]

function StatWidgetFields({
  widget,
  numericFields,
  onChange,
}: {
  widget: RuntimeWidget
  numericFields: FieldList
  onChange: (patch: Partial<RuntimeWidget>) => void
}) {
  const showFieldPicker = widget.config?.aggregation && widget.config.aggregation !== "count"
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label>Aggregation</Label>
        <Select
          value={widget.config?.aggregation ?? "count"}
          onValueChange={v =>
            onChange({
              config: { ...widget.config, aggregation: v as "count" | "sum" | "avg" | "min" | "max" },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATIONS.map(a => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showFieldPicker && <NumericFieldPicker widget={widget} numericFields={numericFields} onChange={onChange} />}
    </div>
  )
}

function ChartWidgetFields({
  widget,
  numericFields,
  onChange,
}: {
  widget: RuntimeWidget
  numericFields: FieldList
  onChange: (patch: Partial<RuntimeWidget>) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="space-y-1">
        <Label>Chart type</Label>
        <Select
          value={widget.config?.chartType ?? "bar"}
          onValueChange={v => onChange({ config: { ...widget.config, chartType: v as "bar" | "line" } })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="line">Line</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <NumericFieldPicker widget={widget} numericFields={numericFields} onChange={onChange} />
      <div className="space-y-1">
        <Label>Limit</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={widget.config?.limit ?? 10}
          onChange={e => onChange({ config: { ...widget.config, limit: Number(e.target.value) || 10 } })}
        />
      </div>
    </div>
  )
}

function NumericFieldPicker({
  widget,
  numericFields,
  onChange,
}: {
  widget: RuntimeWidget
  numericFields: FieldList
  onChange: (patch: Partial<RuntimeWidget>) => void
}) {
  return (
    <div className="space-y-1">
      <Label>Numeric field</Label>
      <Select
        value={widget.config?.field ?? ""}
        onValueChange={v => onChange({ config: { ...widget.config, field: v } })}
      >
        <SelectTrigger>
          <SelectValue placeholder={numericFields.length === 0 ? "No numeric fields" : "Pick a field"} />
        </SelectTrigger>
        <SelectContent>
          {numericFields.map(f => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function TableWidgetFields({
  widget,
  onChange,
}: {
  widget: RuntimeWidget
  onChange: (patch: Partial<RuntimeWidget>) => void
}) {
  return (
    <div className="space-y-1">
      <Label>Columns (comma-separated field keys, blank = first 4)</Label>
      <Input
        value={widget.config?.columns?.join(", ") ?? ""}
        onChange={e =>
          onChange({
            config: {
              ...widget.config,
              columns: e.target.value
                .split(",")
                .map(s => s.trim())
                .filter(Boolean),
            },
          })
        }
        placeholder="name, status, amount"
      />
    </div>
  )
}
