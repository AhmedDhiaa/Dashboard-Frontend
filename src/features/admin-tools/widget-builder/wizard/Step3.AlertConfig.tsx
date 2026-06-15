"use client"

import { Input } from "@/ui/design-system/primitives/input"
import { Field, type AlertForm } from "./Step3.shared"

interface Props {
  form: AlertForm
  setForm: React.Dispatch<React.SetStateAction<AlertForm>>
  errors: Record<string, string>
}

export function AlertConfig({ form, setForm, errors }: Props) {
  const u = <K extends keyof AlertForm>(k: K, v: AlertForm[K]) => setForm(prev => ({ ...prev, [k]: v }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Severity">
        <select
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={form.severity}
          onChange={e => u("severity", e.target.value as AlertForm["severity"])}
        >
          {(["info", "success", "warning", "destructive"] as const).map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Message field" error={errors.messageField}>
        <Input value={form.messageField} onChange={e => u("messageField", e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.hideWhenEmpty} onChange={e => u("hideWhenEmpty", e.target.checked)} />
        Hide when source is empty
      </label>
    </div>
  )
}
