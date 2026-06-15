"use client"

/**
 * Rich color controls, grouped into the Colors-tab sub-sections
 * (Surfaces / Brand / Status / Sidebar / Charts).
 *
 * Each row is seeded from the REAL effective value (draft ?? live ?? default)
 * and offers:
 *  - a native swatch (`<input type="color">`, hex, two-way),
 *  - a text field accepting any CSS color (oklch / hex / named),
 *  - a "reset to default" affordance,
 *  - a row of curated suggested swatches to click-apply,
 *  - a dirty dot + a "default"/"overridden" badge (never "(default)").
 */

import { RotateCcw } from "lucide-react"
import { Input } from "@/ui/design-system/primitives/input"
import { Button } from "@/ui/design-system/primitives/button"
import { COLOR_SUGGESTIONS, COLOR_TOKENS, type TokenSpec } from "./token-catalog"
import { cssColorToHex } from "./color-utils"
import { effectiveValue } from "./token-value"
import { OriginBadge } from "./OriginBadge"

interface ColorControlsProps {
  /** Only render tokens belonging to this group id. */
  group: string
  draft: Record<string, string>
  live: Record<string, string>
  onChange: (key: string, value: string) => void
  onReset: (key: string) => void
}

const SPECS_BY_GROUP = new Map<string, TokenSpec[]>()
for (const spec of COLOR_TOKENS) {
  const list = SPECS_BY_GROUP.get(spec.group) ?? []
  list.push(spec)
  SPECS_BY_GROUP.set(spec.group, list)
}

export function ColorControls({ group, draft, live, onChange, onReset }: ColorControlsProps): React.ReactNode {
  const specs = SPECS_BY_GROUP.get(group) ?? []
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {specs.map(spec => {
        const eff = effectiveValue(spec.key, draft, live)
        return (
          <ColorRow
            key={spec.key}
            spec={spec}
            value={eff.value}
            origin={eff.origin}
            dirty={eff.dirty}
            overridden={eff.overridden}
            onChange={v => onChange(spec.key, v)}
            onReset={() => onReset(spec.key)}
          />
        )
      })}
    </div>
  )
}

interface ColorRowProps {
  spec: TokenSpec
  value: string
  origin: "default" | "live" | "draft"
  dirty: boolean
  overridden: boolean
  onChange: (v: string) => void
  onReset: () => void
}

function ColorRow({ spec, value, origin, dirty, overridden, onChange, onReset }: ColorRowProps) {
  const hex = cssColorToHex(value)
  return (
    <div className="bg-card p-3 transition-colors hover:bg-accent/5">
      <div className="flex items-center gap-3">
        <label
          className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm"
          title="Pick a color"
          style={{ backgroundColor: value || hex }}
        >
          <input
            type="color"
            value={hex}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${spec.label} color`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{spec.label}</span>
            {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" title="Edited (unsaved)" />}
            <OriginBadge origin={origin} overridden={overridden} />
          </div>
          <code className="block truncate text-[10px] text-muted-foreground">{spec.key}</code>
        </div>
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 w-40 shrink-0 font-mono text-xs"
          aria-label={`${spec.label} value`}
        />
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
      <SuggestionSwatches current={hex} onPick={onChange} />
    </div>
  )
}

/** A short row of curated colour suggestions; clicking applies the value. */
function SuggestionSwatches({ current, onPick }: { current: string; onPick: (v: string) => void }) {
  return (
    <div className="mt-2.5 flex items-center gap-1.5 ps-12">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Suggestions</span>
      <div className="flex flex-wrap gap-1.5">
        {COLOR_SUGGESTIONS.map(color => {
          const active = cssColorToHex(color) === current
          return (
            <button
              key={color}
              type="button"
              onClick={() => onPick(color)}
              title={color}
              aria-label={`Apply ${color}`}
              className={`h-5 w-5 rounded-md border transition-transform hover:scale-110 ${active ? "border-primary ring-1 ring-primary" : "border-border"}`}
              style={{ backgroundColor: color }}
            />
          )
        })}
      </div>
    </div>
  )
}
