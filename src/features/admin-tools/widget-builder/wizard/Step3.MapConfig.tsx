"use client"

import { Input } from "@/ui/design-system/primitives/input"
import { Field, type MapForm } from "./Step3.shared"

interface Props {
  form: MapForm
  setForm: React.Dispatch<React.SetStateAction<MapForm>>
  errors: Record<string, string>
}

export function MapConfig({ form, setForm, errors }: Props) {
  const u = <K extends keyof MapForm>(k: K, v: MapForm[K]) => setForm(prev => ({ ...prev, [k]: v }))
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Field label="Position field" hint="object with { lat, lng }" error={errors.positionField}>
        <Input value={form.positionField} onChange={e => u("positionField", e.target.value)} />
      </Field>
      <Field label="Popup field (optional)">
        <Input value={form.popupField} onChange={e => u("popupField", e.target.value)} />
      </Field>
      <Field label="Default zoom (1–20)">
        <Input
          type="number"
          min={1}
          max={20}
          value={form.defaultZoom}
          onChange={e => u("defaultZoom", Math.min(20, Math.max(1, Number(e.target.value))))}
        />
      </Field>
    </div>
  )
}
