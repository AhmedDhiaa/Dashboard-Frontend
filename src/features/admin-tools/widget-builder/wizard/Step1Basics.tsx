"use client"

/**
 * Wizard step 1 — top-level metadata: id, title key, category, refresh
 * policy, permission key. The category drives the visualization's
 * discriminant in step 3, so we lock it in early.
 */

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import type { WidgetDraft } from "./useWidgetWizardState"
import { WIDGET_CATEGORIES, type WidgetCategory } from "../types/widget-schema"

const ID_RE = /^[a-z][a-z0-9-]*$/
const PERM_RE = /^[A-Z][A-Za-z0-9.]*$/

interface Form {
  id: string
  titleKey: string
  category: WidgetCategory
  permissionKey: string
  refreshMode: "manual" | "interval" | "socket"
  intervalMs: number
  topic: string
}

const DEFAULT_FORM: Form = {
  id: "",
  titleKey: "",
  category: "kpi",
  permissionKey: "",
  refreshMode: "manual",
  intervalMs: 30_000,
  topic: "",
}

function fromDraft(d: WidgetDraft): Form {
  const refresh = d.refresh ?? { mode: "manual" }
  return {
    id: d.id ?? "",
    titleKey: d.titleKey ?? "",
    category: (d.category ?? "kpi") as WidgetCategory,
    permissionKey: d.permissionKey ?? "",
    refreshMode: refresh.mode,
    intervalMs: refresh.mode === "interval" ? refresh.intervalMs : 30_000,
    topic: refresh.mode === "socket" ? refresh.topic : "",
  }
}

interface Step1Props {
  draft: WidgetDraft
  onComplete: (next: WidgetDraft) => void
}

export function Step1Basics({ draft, onComplete }: Step1Props): React.ReactNode {
  const [form, setForm] = useState<Form>(DEFAULT_FORM)

  useEffect(() => {
    setForm(fromDraft(draft))
  }, [draft])

  const errors = useMemo(() => collectErrors(form), [form])
  const canSubmit = Object.keys(errors).length === 0

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Widget id" hint="lowercase, hyphens. e.g. todays-orders" error={errors.id}>
          <Input value={form.id} onChange={e => update("id", e.target.value)} />
        </Field>
        <Field label="Translation key" hint="e.g. dashboard.widgets.todays_orders" error={errors.titleKey}>
          <Input value={form.titleKey} onChange={e => update("titleKey", e.target.value)} />
        </Field>
        <Field label="Category" error={errors.category}>
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={form.category}
            onChange={e => update("category", e.target.value as WidgetCategory)}
          >
            {WIDGET_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Permission key" hint="e.g. Api.Order" error={errors.permissionKey}>
          <Input value={form.permissionKey} onChange={e => update("permissionKey", e.target.value)} />
        </Field>
        <Field label="Refresh mode">
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={form.refreshMode}
            onChange={e => update("refreshMode", e.target.value as Form["refreshMode"])}
          >
            <option value="manual">Manual</option>
            <option value="interval">Interval</option>
            <option value="socket">Socket</option>
          </select>
        </Field>
        {form.refreshMode === "interval" && (
          <Field label="Interval (ms)" hint="≥ 1000" error={errors.intervalMs}>
            <Input
              type="number"
              min={1000}
              value={form.intervalMs}
              onChange={e => update("intervalMs", Number(e.target.value))}
            />
          </Field>
        )}
        {form.refreshMode === "socket" && (
          <Field label="Socket topic" error={errors.topic}>
            <Input value={form.topic} onChange={e => update("topic", e.target.value)} />
          </Field>
        )}
      </div>
      <Button disabled={!canSubmit} onClick={() => onComplete(buildPatch(form))}>
        Continue → Data source
      </Button>
    </div>
  )
}

function buildPatch(form: Form): WidgetDraft {
  const refresh =
    form.refreshMode === "manual"
      ? { mode: "manual" as const }
      : form.refreshMode === "interval"
        ? { mode: "interval" as const, intervalMs: form.intervalMs }
        : { mode: "socket" as const, topic: form.topic }
  return {
    id: form.id,
    titleKey: form.titleKey,
    category: form.category,
    permissionKey: form.permissionKey,
    refresh,
  }
}

function collectErrors(form: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!form.id) e.id = "Required"
  else if (!ID_RE.test(form.id)) e.id = "lowercase letters, digits, hyphens; must start with a letter"
  if (!form.titleKey) e.titleKey = "Required"
  if (!form.permissionKey) e.permissionKey = "Required"
  else if (!PERM_RE.test(form.permissionKey)) e.permissionKey = "PascalCase, dotted (e.g. Api.Order)"
  if (form.refreshMode === "interval" && form.intervalMs < 1000) e.intervalMs = "≥ 1000ms"
  if (form.refreshMode === "socket" && !form.topic) e.topic = "Required"
  return e
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
