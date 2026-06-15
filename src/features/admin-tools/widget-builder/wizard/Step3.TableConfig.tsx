"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Field, type TableForm } from "./Step3.shared"

interface Props {
  form: TableForm
  setForm: React.Dispatch<React.SetStateAction<TableForm>>
  errors: Record<string, string>
}

export function TableConfig({ form, setForm, errors }: Props) {
  const updateCol = (i: number, patch: Partial<TableForm["columns"][number]>) =>
    setForm(prev => ({ ...prev, columns: prev.columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }))
  const addCol = () =>
    setForm(prev => ({ ...prev, columns: [...prev.columns, { field: "", label: "", align: "", format: "" }] }))
  const removeCol = (i: number) => setForm(prev => ({ ...prev, columns: prev.columns.filter((_, idx) => idx !== i) }))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Columns</span>
        <Button size="sm" variant="ghost" onClick={addCol} className="gap-1">
          <Plus className="h-3 w-3" /> Add column
        </Button>
      </div>
      {errors.columns && <p className="text-xs text-destructive">{errors.columns}</p>}
      <ul className="space-y-2">
        {form.columns.map((c, i) => (
          <li key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border border-border rounded-md p-2">
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Field</label>
              <Input value={c.field} onChange={e => updateCol(i, { field: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Label (EN)</label>
              <Input value={c.label} onChange={e => updateCol(i, { label: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Align</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={c.align}
                onChange={e => updateCol(i, { align: e.target.value as TableForm["columns"][number]["align"] })}
              >
                {(["", "start", "center", "end"] as const).map(t => (
                  <option key={t} value={t}>
                    {t || "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-muted-foreground">Format</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={c.format}
                onChange={e => updateCol(i, { format: e.target.value })}
              >
                {(["", "text", "number", "currency", "date", "badge"] as const).map(t => (
                  <option key={t} value={t}>
                    {t || "—"}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeCol(i)}
                disabled={form.columns.length <= 1}
                className="text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Field label="Page size">
        <Input
          type="number"
          min={1}
          value={form.pageSize}
          onChange={e => setForm(prev => ({ ...prev, pageSize: Math.max(1, Number(e.target.value)) }))}
        />
      </Field>
    </div>
  )
}
