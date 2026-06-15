"use client"

/**
 * Wizard step 3 — visualization config orchestrator.
 *
 * The shape of the form changes by widget category:
 *
 *   kpi    → single value field, optional trend, accent token, icon
 *   chart  → chart type, x-axis, list of y-axis series + token colors
 *   table  → ordered column list (field/format/align)
 *   alert  → severity + message field, hide-when-empty toggle
 *   map    → position field (lat/lng), popup field, default zoom
 *
 * Each category lives in its own `Step3.<Category>Config.tsx` file so this
 * orchestrator stays tight: it owns local form state, picks the right
 * sub-form to render, runs the layout sub-form, and wires the
 * back/continue buttons to the wizard's outer step machine. Form types,
 * defaults, draft↔form merge helpers, validation, and the layout sub-form
 * live in `Step3.shared.tsx`.
 */

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import type { WidgetDraft } from "./useWidgetWizardState"
import {
  buildVisualization,
  collectErrors,
  defaultForCategory,
  fromDraft,
  LayoutForm,
  type AlertForm,
  type ChartForm,
  type Form,
  type KpiForm,
  type MapForm,
  type TableForm,
} from "./Step3.shared"
import { KpiConfig } from "./Step3.KpiConfig"
import { ChartConfig } from "./Step3.ChartConfig"
import { TableConfig } from "./Step3.TableConfig"
import { AlertConfig } from "./Step3.AlertConfig"
import { MapConfig } from "./Step3.MapConfig"

interface Props {
  draft: WidgetDraft
  onBack: () => void
  onComplete: (next: WidgetDraft) => void
}

export function Step3Visualization({ draft, onBack, onComplete }: Props): React.ReactNode {
  const [form, setForm] = useState<Form>(() => defaultForCategory(draft.category ?? "kpi"))

  // Re-seed when the wizard category changes (rare — admins usually don't go
  // back to step 1 to change category, but if they do, we shouldn't carry
  // over a chart-shaped form into a kpi widget).
  useEffect(() => {
    setForm(fromDraft(draft))
  }, [draft])

  const errors = useMemo(() => collectErrors(form), [form])
  const canSubmit = Object.keys(errors).length === 0

  return (
    <div className="space-y-4 max-w-3xl">
      <CategoryConfig form={form} setForm={setForm} errors={errors} />
      <LayoutForm form={form} setForm={setForm} />
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button
          disabled={!canSubmit}
          onClick={() =>
            onComplete({
              visualization: buildVisualization(form),
              layout: { w: form.layoutW, h: form.layoutH },
            })
          }
        >
          Continue → Preview
        </Button>
      </div>
    </div>
  )
}

function CategoryConfig({
  form,
  setForm,
  errors,
}: {
  form: Form
  setForm: React.Dispatch<React.SetStateAction<Form>>
  errors: Record<string, string>
}): React.ReactNode {
  // The casts below narrow the union dispatch to each sub-form's specific
  // setState signature. Safe because the discriminator (`form.type`) and
  // the form variant move together in lockstep.
  switch (form.type) {
    case "kpi":
      return (
        <KpiConfig form={form} setForm={setForm as React.Dispatch<React.SetStateAction<KpiForm>>} errors={errors} />
      )
    case "chart":
      return (
        <ChartConfig form={form} setForm={setForm as React.Dispatch<React.SetStateAction<ChartForm>>} errors={errors} />
      )
    case "table":
      return (
        <TableConfig form={form} setForm={setForm as React.Dispatch<React.SetStateAction<TableForm>>} errors={errors} />
      )
    case "alert":
      return (
        <AlertConfig form={form} setForm={setForm as React.Dispatch<React.SetStateAction<AlertForm>>} errors={errors} />
      )
    case "map":
      return (
        <MapConfig form={form} setForm={setForm as React.Dispatch<React.SetStateAction<MapForm>>} errors={errors} />
      )
  }
}
