"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Field, ColorTokenSelect, DEFAULT_TOKENS, type ChartForm, type ChartType } from "./Step3.shared"

interface Props {
  form: ChartForm
  setForm: React.Dispatch<React.SetStateAction<ChartForm>>
  errors: Record<string, string>
}

// eslint-disable-next-line max-lines-per-function -- Chart config has many controlled fields by design (chart type, axes, series, colors, toggles)
export function ChartConfig({ form, setForm, errors }: Props) {
  const u = <K extends keyof ChartForm>(k: K, v: ChartForm[K]) => setForm(prev => ({ ...prev, [k]: v }))
  const updateY = (i: number, patch: Partial<ChartForm["yAxes"][number]>) =>
    setForm(prev => ({ ...prev, yAxes: prev.yAxes.map((y, idx) => (idx === i ? { ...y, ...patch } : y)) }))
  const updateColor = (i: number, c: string) =>
    setForm(prev => {
      const next = [...prev.colors]
      next[i] = c
      return { ...prev, colors: next }
    })
  const addY = () =>
    setForm(prev => ({
      ...prev,
      yAxes: [...prev.yAxes, { field: "", label: "", format: "" }],
      colors: [...prev.colors, DEFAULT_TOKENS[prev.colors.length % DEFAULT_TOKENS.length] ?? "var(--primary)"],
    }))
  const removeY = (i: number) =>
    setForm(prev => ({
      ...prev,
      yAxes: prev.yAxes.filter((_, idx) => idx !== i),
      colors: prev.colors.filter((_, idx) => idx !== i),
    }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Chart type">
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={form.chartType}
            onChange={e => u("chartType", e.target.value as ChartType)}
          >
            {(["line", "bar", "pie", "area", "donut"] as const).map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="X-axis field">
          <Input value={form.xField} onChange={e => u("xField", e.target.value)} />
        </Field>
        <Field label="X-axis format">
          <select
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={form.xFormat}
            onChange={e => u("xFormat", e.target.value)}
          >
            {(["", "number", "currency", "percentage", "date", "datetime", "text"] as const).map(t => (
              <option key={t} value={t}>
                {t || "—"}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Y-axis series</span>
          <Button size="sm" variant="ghost" onClick={addY} className="gap-1">
            <Plus className="h-3 w-3" /> Add series
          </Button>
        </div>
        {errors.yAxes && <p className="text-xs text-destructive">{errors.yAxes}</p>}
        <ul className="space-y-2">
          {form.yAxes.map((y, i) => (
            <li
              key={i}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border border-border rounded-md p-2"
            >
              <div className="md:col-span-3">
                <label className="text-xs text-muted-foreground">Field</label>
                <Input value={y.field} onChange={e => updateY(i, { field: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-muted-foreground">Label (EN)</label>
                <Input value={y.label} onChange={e => updateY(i, { label: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Format</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                  value={y.format}
                  onChange={e => updateY(i, { format: e.target.value })}
                >
                  {(["", "number", "currency", "percentage", "date", "datetime", "text"] as const).map(t => (
                    <option key={t} value={t}>
                      {t || "—"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-muted-foreground">Color token</label>
                <ColorTokenSelect value={form.colors[i] ?? "var(--primary)"} onChange={v => updateColor(i, v)} />
              </div>
              <div className="md:col-span-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeY(i)}
                  disabled={form.yAxes.length <= 1}
                  className="text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.showLegend} onChange={e => u("showLegend", e.target.checked)} />
          Show legend
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.stacked} onChange={e => u("stacked", e.target.checked)} />
          Stacked
        </label>
      </div>
    </div>
  )
}
