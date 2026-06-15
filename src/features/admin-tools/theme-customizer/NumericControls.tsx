"use client"

/**
 * Slider / select / text token controls shared by the Shape & Size, Components,
 * Effects and Typography groups.
 *
 * Every control is seeded from the REAL effective value (draft ?? live ??
 * default). Sliders pair a range with a numeric input, a unit label and a few
 * curated quick-pick chips. Selects render a native-styled dropdown. Text rows
 * accept any CSS value. Each carries a dirty dot, a default/overridden badge,
 * and a reset-to-default affordance.
 */

import { RotateCcw } from "lucide-react"
import { Input } from "@/ui/design-system/primitives/input"
import { Button } from "@/ui/design-system/primitives/button"
import { Slider } from "@/ui/design-system/primitives/slider"
import type { TokenSpec } from "./token-catalog"
import { displayNumber, effectiveValue, formatWithUnit, numericPart } from "./token-value"
import { OriginBadge } from "./OriginBadge"

interface ControlsProps {
  specs: TokenSpec[]
  draft: Record<string, string>
  live: Record<string, string>
  onChange: (key: string, value: string) => void
  onReset: (key: string) => void
}

export function TokenControls({ specs, draft, live, onChange, onReset }: ControlsProps): React.ReactNode {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {specs.map(spec => {
        const eff = effectiveValue(spec.key, draft, live)
        const common = {
          spec,
          value: eff.value,
          origin: eff.origin,
          dirty: eff.dirty,
          overridden: eff.overridden,
          onChange: (v: string) => onChange(spec.key, v),
          onReset: () => onReset(spec.key),
        }
        if (spec.input === "slider") return <SliderRow key={spec.key} {...common} />
        if (spec.input === "select") return <SelectRow key={spec.key} {...common} />
        return <TextRow key={spec.key} {...common} />
      })}
    </div>
  )
}

interface RowProps {
  spec: TokenSpec
  value: string
  origin: "default" | "live" | "draft"
  dirty: boolean
  overridden: boolean
  onChange: (v: string) => void
  onReset: () => void
}

/** Shared header: label + dirty dot + origin badge + reset button. */
function RowHeader({ spec, dirty, origin, overridden, onReset, right }: RowProps & { right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium">{spec.label}</span>
        {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="Edited (unsaved)" />}
        <OriginBadge origin={origin} overridden={overridden} />
      </div>
      <div className="flex items-center gap-2">
        {right}
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={onReset}
          disabled={!overridden && !dirty}
          title="Reset to default"
          aria-label={`Reset ${spec.label}`}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SliderRow(props: RowProps) {
  const { spec, value, onChange } = props
  const n = numericPart(value, numericPart(spec.defaultValue))
  const unit = spec.unit ?? ""
  const min = spec.min ?? 0
  const max = spec.max ?? 1
  const step = spec.step ?? 0.01

  return (
    <div className="space-y-2.5 bg-card p-3 transition-colors hover:bg-accent/5">
      <RowHeader
        {...props}
        right={<code className="font-mono text-xs text-muted-foreground">{value}</code>}
      />
      <div className="flex items-center gap-3">
        <Slider
          aria-label={spec.label}
          min={min}
          max={max}
          step={step}
          value={[n]}
          onValueChange={([v]) => onChange(formatWithUnit(v ?? n, unit))}
          className="flex-1"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Input
            type="number"
            value={displayNumber(n, step)}
            min={min}
            max={max}
            step={step}
            onChange={e => onChange(formatWithUnit(parseFloat(e.target.value || "0"), unit))}
            className="h-8 w-20 font-mono text-xs"
            aria-label={`${spec.label} number`}
          />
          {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
        </div>
      </div>
      {spec.picks && spec.picks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {spec.picks.map(pick => {
            const active = value === pick.value
            return (
              <button
                key={pick.value}
                type="button"
                onClick={() => onChange(pick.value)}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {pick.label}
              </button>
            )
          })}
        </div>
      )}
      {spec.hint && <p className="text-[10px] text-muted-foreground">{spec.hint}</p>}
    </div>
  )
}

function SelectRow(props: RowProps) {
  const { spec, value, onChange } = props
  return (
    <div className="space-y-2 bg-card p-3 transition-colors hover:bg-accent/5">
      <RowHeader {...props} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={spec.label}
        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        {spec.options?.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {spec.hint && <p className="text-[10px] text-muted-foreground">{spec.hint}</p>}
    </div>
  )
}

function TextRow(props: RowProps) {
  const { spec, value, onChange } = props
  return (
    <div className="space-y-2 bg-card p-3 transition-colors hover:bg-accent/5">
      <RowHeader {...props} />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="font-mono text-xs"
        aria-label={`${spec.label} value`}
      />
      <code className="block truncate text-[10px] text-muted-foreground">{spec.key}</code>
      {spec.hint && <p className="text-[10px] text-muted-foreground">{spec.hint}</p>}
    </div>
  )
}
