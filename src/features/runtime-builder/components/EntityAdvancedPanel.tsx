"use client"

/**
 * EntityAdvancedPanel — feature flags, filters, and bulk actions for a
 * runtime entity. Lives in its own file so EntityBuilder doesn't keep
 * growing past the maintainable line budget.
 *
 * Bulk actions and filters are optional and most users won't touch them;
 * they collapse by default to keep the create-entity flow short.
 */

import { useState } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import type {
  RuntimeBulkAction,
  RuntimeBulkActionKind,
  RuntimeEntity,
  RuntimeFeatures,
  RuntimeField,
  RuntimeFilter,
  RuntimeFilterOperator,
  RuntimeFilterWidget,
} from "../types"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { Switch } from "@/ui/design-system/primitives/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"
import { genId } from "../store"

const FEATURE_KEYS: { key: keyof RuntimeFeatures; label: string; description: string }[] = [
  { key: "view", label: "View", description: "Show the entity's list and detail pages" },
  { key: "create", label: "Create", description: "Allow inserting new records" },
  { key: "edit", label: "Edit", description: "Allow updating existing records" },
  { key: "delete", label: "Delete", description: "Allow removing records" },
  { key: "export", label: "Export", description: "Show export-to-CSV button on the list view" },
  { key: "import", label: "Import", description: "Show import-from-CSV button on the list view" },
]

const FILTER_OPERATORS: { value: RuntimeFilterOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "greater or equal" },
  { value: "lte", label: "less or equal" },
]

const FILTER_WIDGETS: { value: RuntimeFilterWidget; label: string }[] = [
  { value: "text", label: "Text input" },
  { value: "boolean", label: "Yes/No toggle" },
  { value: "date-range", label: "Date range" },
]

const BULK_ACTION_KINDS: { value: RuntimeBulkActionKind; label: string }[] = [
  { value: "delete", label: "Delete selected" },
  { value: "export", label: "Export selected" },
  { value: "publish", label: "Publish selected" },
  { value: "archive", label: "Archive selected" },
]

export interface EntityAdvancedPanelProps {
  entity: RuntimeEntity
  onChange: (patch: Partial<RuntimeEntity>) => void
}

export function EntityAdvancedPanel({ entity, onChange }: EntityAdvancedPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const filterCount = entity.filters?.length ?? 0
  const bulkActionCount = entity.bulkActions?.length ?? 0

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex w-full items-center gap-2 text-start"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CardTitle className="text-base">Advanced</CardTitle>
          {!expanded && (
            <span className="text-xs text-muted-foreground ms-auto">
              {filterCount} filter(s) · {bulkActionCount} bulk action(s)
            </span>
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-6">
          <FeaturesBlock entity={entity} onChange={onChange} />
          <FiltersBlock entity={entity} onChange={onChange} />
          <BulkActionsBlock entity={entity} onChange={onChange} />
          <PermissionBlock entity={entity} onChange={onChange} />
        </CardContent>
      )}
    </Card>
  )
}

function FeaturesBlock({ entity, onChange }: EntityAdvancedPanelProps) {
  const features = entity.features ?? {}
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Features</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURE_KEYS.map(({ key, label, description }) => (
          <label key={key} className="flex items-start gap-3 rounded-md border bg-muted/20 px-3 py-2 cursor-pointer">
            <Switch
              checked={features[key] ?? defaultFeature(key)}
              onCheckedChange={v => onChange({ features: { ...features, [key]: v } })}
              className="mt-0.5"
            />
            <div className="text-sm">
              <p className="font-medium leading-tight">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function defaultFeature(key: keyof RuntimeFeatures): boolean {
  return key !== "export" && key !== "import"
}

function FiltersBlock({ entity, onChange }: EntityAdvancedPanelProps) {
  const filters = entity.filters ?? []
  const addFilter = () => {
    const firstField = entity.fields[0]?.key ?? ""
    if (!firstField) return
    const next: RuntimeFilter = {
      id: genId("flt"),
      field: firstField,
      operator: "eq",
      widget: "text",
    }
    onChange({ filters: [...filters, next] })
  }
  const updateFilter = (id: string, patch: Partial<RuntimeFilter>) => {
    onChange({ filters: filters.map(f => (f.id === id ? { ...f, ...patch } : f)) })
  }
  const removeFilter = (id: string) => {
    onChange({ filters: filters.filter(f => f.id !== id) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">List filters</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addFilter}
          disabled={entity.fields.length === 0}
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          Add filter
        </Button>
      </div>
      {filters.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No filters configured. The list view will only show the search box.
        </p>
      ) : (
        filters.map(f => (
          <FilterRow
            key={f.id}
            filter={f}
            fields={entity.fields}
            onChange={patch => updateFilter(f.id, patch)}
            onRemove={() => removeFilter(f.id)}
          />
        ))
      )}
    </div>
  )
}

function FilterRow({
  filter,
  fields,
  onChange,
  onRemove,
}: {
  filter: RuntimeFilter
  fields: RuntimeField[]
  onChange: (patch: Partial<RuntimeFilter>) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-2 md:grid-cols-[1fr_1fr_1fr_2fr_auto]">
      <Select value={filter.field} onValueChange={v => onChange({ field: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map(f => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filter.operator} onValueChange={v => onChange({ operator: v as RuntimeFilterOperator })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPERATORS.map(op => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filter.widget ?? "text"} onValueChange={v => onChange({ widget: v as RuntimeFilterWidget })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_WIDGETS.map(w => (
            <SelectItem key={w.value} value={w.value}>
              {w.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        placeholder="Label (optional)"
        value={filter.label ?? ""}
        onChange={e => onChange({ label: e.target.value || undefined })}
      />
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove filter">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}

function BulkActionsBlock({ entity, onChange }: EntityAdvancedPanelProps) {
  const actions = entity.bulkActions ?? []
  const addAction = () => {
    const next: RuntimeBulkAction = {
      id: genId("ba"),
      label: "New action",
      kind: "delete",
      confirm: true,
    }
    onChange({ bulkActions: [...actions, next] })
  }
  const updateAction = (id: string, patch: Partial<RuntimeBulkAction>) => {
    onChange({ bulkActions: actions.map(a => (a.id === id ? { ...a, ...patch } : a)) })
  }
  const removeAction = (id: string) => {
    onChange({ bulkActions: actions.filter(a => a.id !== id) })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bulk actions</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addAction} className="gap-1">
          <Plus className="h-3 w-3" />
          Add bulk action
        </Button>
      </div>
      {actions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No bulk actions. Selecting rows will show no toolbar.</p>
      ) : (
        actions.map(a => (
          <div key={a.id} className="grid gap-2 rounded-md border bg-muted/20 p-2 md:grid-cols-[2fr_2fr_auto_auto]">
            <Input placeholder="Label" value={a.label} onChange={e => updateAction(a.id, { label: e.target.value })} />
            <Select value={a.kind} onValueChange={v => updateAction(a.id, { kind: v as RuntimeBulkActionKind })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BULK_ACTION_KINDS.map(k => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="inline-flex items-center gap-2 text-xs px-2">
              <Switch checked={a.confirm ?? true} onCheckedChange={v => updateAction(a.id, { confirm: v })} />
              Confirm
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeAction(a.id)}
              aria-label="Remove bulk action"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))
      )}
    </div>
  )
}

function PermissionBlock({ entity, onChange }: EntityAdvancedPanelProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="re-perm" className="text-xs uppercase tracking-wider text-muted-foreground">
        Permission key
      </Label>
      <Input
        id="re-perm"
        value={entity.permissionKey ?? ""}
        onChange={e => onChange({ permissionKey: e.target.value || undefined })}
        placeholder={`Api.${entity.singularName || "Entity"} (default)`}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        ABP permission prefix. Leave blank to derive from the entity name on materialize.
      </p>
    </div>
  )
}
