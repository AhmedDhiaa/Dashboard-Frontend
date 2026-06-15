"use client"

/**
 * Wizard step 2 — pick a data source. Two modes:
 *   • entity-list: pick a registered entity, optionally aggregate
 *   • api-call:    paste an endpoint and the path inside the response
 *                  payload that points at the array of records
 *
 * The chosen source is stamped onto draft.dataSource so step 3 can map
 * fields onto axes / columns.
 */

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { getRegisteredEntities } from "@/core/entities/registry"
import type { WidgetDraft } from "./useWidgetWizardState"
import type { DataSource } from "../types/widget-schema"

interface Form {
  type: "entity-list" | "api-call"
  entityName: string
  aggregateOp: "" | "count" | "sum" | "avg" | "min" | "max"
  aggregateField: string
  groupBy: string
  endpoint: string
  method: "GET" | "POST"
  itemsPath: string
}

const DEFAULT_FORM: Form = {
  type: "entity-list",
  entityName: "",
  aggregateOp: "",
  aggregateField: "",
  groupBy: "",
  endpoint: "",
  method: "GET",
  itemsPath: "items",
}

function fromDraft(d: WidgetDraft): Form {
  const ds = d.dataSource
  if (!ds) return DEFAULT_FORM
  if (ds.type === "entity-list") {
    return {
      ...DEFAULT_FORM,
      type: "entity-list",
      entityName: ds.entityName,
      aggregateOp: ds.aggregateOp ?? "",
      aggregateField: ds.aggregateField ?? "",
      groupBy: ds.groupBy ?? "",
    }
  }
  return {
    ...DEFAULT_FORM,
    type: "api-call",
    endpoint: ds.endpoint,
    method: ds.method,
    itemsPath: ds.itemsPath,
  }
}

interface Props {
  draft: WidgetDraft
  onBack: () => void
  onComplete: (next: WidgetDraft) => void
}

export function Step2DataSource({ draft, onBack, onComplete }: Props): React.ReactNode {
  const [form, setForm] = useState<Form>(DEFAULT_FORM)

  useEffect(() => {
    setForm(fromDraft(draft))
  }, [draft])

  const entityOptions = useMemo(() => getRegisteredEntities().sort(), [])
  const errors = collectErrors(form)
  const canSubmit = Object.keys(errors).length === 0

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <TypeButton active={form.type === "entity-list"} onClick={() => update("type", "entity-list")}>
          Registered entity
        </TypeButton>
        <TypeButton active={form.type === "api-call"} onClick={() => update("type", "api-call")}>
          API endpoint
        </TypeButton>
      </div>

      {form.type === "entity-list" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Entity" error={errors.entityName}>
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.entityName}
              onChange={e => update("entityName", e.target.value)}
            >
              <option value="">— pick —</option>
              {entityOptions.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Aggregate operation" hint="leave blank for raw rows">
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.aggregateOp}
              onChange={e => update("aggregateOp", e.target.value as Form["aggregateOp"])}
            >
              <option value="">none</option>
              <option value="count">count</option>
              <option value="sum">sum</option>
              <option value="avg">avg</option>
              <option value="min">min</option>
              <option value="max">max</option>
            </select>
          </Field>
          {form.aggregateOp && form.aggregateOp !== "count" && (
            <Field label="Aggregate field" error={errors.aggregateField}>
              <Input value={form.aggregateField} onChange={e => update("aggregateField", e.target.value)} />
            </Field>
          )}
          <Field label="Group by (optional)">
            <Input value={form.groupBy} onChange={e => update("groupBy", e.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Endpoint" hint="e.g. /api/app/reports/revenue-by-day" error={errors.endpoint}>
            <Input value={form.endpoint} onChange={e => update("endpoint", e.target.value)} />
          </Field>
          <Field label="Method">
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.method}
              onChange={e => update("method", e.target.value as Form["method"])}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </Field>
          <Field label="Items path" hint="dot-path inside the response payload, e.g. data.items">
            <Input value={form.itemsPath} onChange={e => update("itemsPath", e.target.value)} />
          </Field>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button disabled={!canSubmit} onClick={() => onComplete({ dataSource: buildSource(form) })}>
          Continue → Visualization
        </Button>
      </div>
    </div>
  )
}

function buildSource(form: Form): DataSource {
  if (form.type === "entity-list") {
    const out: DataSource = {
      type: "entity-list",
      entityName: form.entityName,
    }
    if (form.aggregateOp) out.aggregateOp = form.aggregateOp
    if (form.aggregateField) out.aggregateField = form.aggregateField
    if (form.groupBy) out.groupBy = form.groupBy
    return out
  }
  return {
    type: "api-call",
    endpoint: form.endpoint,
    method: form.method,
    itemsPath: form.itemsPath || "items",
  }
}

function collectErrors(form: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (form.type === "entity-list") {
    if (!form.entityName) e.entityName = "Pick an entity"
    if (form.aggregateOp && form.aggregateOp !== "count" && !form.aggregateField) {
      e.aggregateField = "Required for non-count aggregates"
    }
  } else {
    if (!form.endpoint) e.endpoint = "Required"
    else if (!form.endpoint.startsWith("/")) e.endpoint = "Endpoint must start with /"
  }
  return e
}

function TypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
    >
      {children}
    </button>
  )
}

function Field({
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
