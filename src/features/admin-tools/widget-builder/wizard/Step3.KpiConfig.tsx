"use client"

import { Input } from "@/ui/design-system/primitives/input"
import { Field, ColorTokenSelect, type KpiForm } from "./Step3.shared"

interface Props {
  form: KpiForm
  setForm: React.Dispatch<React.SetStateAction<KpiForm>>
  errors: Record<string, string>
}

export function KpiConfig({ form, setForm, errors }: Props) {
  const u = <K extends keyof KpiForm>(k: K, v: KpiForm[K]) => setForm(prev => ({ ...prev, [k]: v }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Value field" error={errors.valueField}>
        <Input value={form.valueField} onChange={e => u("valueField", e.target.value)} />
      </Field>
      <Field label="Trend field (optional)">
        <Input value={form.trendField} onChange={e => u("trendField", e.target.value)} />
      </Field>
      <Field label="Prefix">
        <Input value={form.prefix} onChange={e => u("prefix", e.target.value)} />
      </Field>
      <Field label="Suffix">
        <Input value={form.suffix} onChange={e => u("suffix", e.target.value)} />
      </Field>
      <Field label="Accent color (token)" error={errors.accentColor}>
        <ColorTokenSelect value={form.accentColor} onChange={v => u("accentColor", v)} />
      </Field>
      <Field label="Icon (lucide name)">
        <Input value={form.icon} onChange={e => u("icon", e.target.value)} placeholder="e.g. ShoppingBag" />
      </Field>
    </div>
  )
}
