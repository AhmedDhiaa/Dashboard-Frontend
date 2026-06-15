"use client"

/**
 * Font picker. Each option renders its own `sample` text in its own
 * `family` so the admin SEES the font (Latin + Arabic) before choosing.
 * Selecting a font writes that family to BOTH `--font-sans` and
 * `--font-arabic`; selecting the default option clears both overrides so the
 * app falls back to its bundled fonts. The active option is derived from the
 * draft via `fontIdFromTokens`. Options are grouped by category (brand /
 * Arabic / sans / serif) so the long self-hosted menu stays scannable.
 */

import { Check } from "lucide-react"
import { cn } from "@/shared/utils"
import {
  DEFAULT_FONT_ID,
  FONT_OPTIONS,
  FONT_CATEGORY_LABELS,
  FONT_TOKEN_KEYS,
  fontIdFromTokens,
  type FontCategory,
  type FontOption,
} from "./fonts"

interface FontPickerProps {
  draft: Record<string, string>
  onChange: (key: string, value: string) => void
  onClear: (key: string) => void
}

const CATEGORY_ORDER: FontCategory[] = ["default", "brand", "arabic", "sans", "serif"]

export function FontPicker({ draft, onChange, onClear }: FontPickerProps): React.ReactNode {
  const activeId = fontIdFromTokens(draft)

  const select = (option: FontOption) => {
    if (option.id === DEFAULT_FONT_ID || !option.family) {
      FONT_TOKEN_KEYS.forEach(onClear)
      return
    }
    FONT_TOKEN_KEYS.forEach(key => onChange(key, option.family))
  }

  return (
    <div className="space-y-5">
      {CATEGORY_ORDER.map(category => {
        const options = FONT_OPTIONS.filter(o => o.category === category)
        if (options.length === 0) return null
        return (
          <section key={category} className="space-y-2.5">
            <h4 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {FONT_CATEGORY_LABELS[category]}
            </h4>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {options.map(option => (
                <FontCard key={option.id} option={option} active={option.id === activeId} onSelect={() => select(option)} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FontCard({ option, active, onSelect }: { option: FontOption; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3.5 text-start transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-border/70 hover:bg-accent/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{option.label}</span>
        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </div>
      <span className="truncate text-lg leading-snug text-foreground" style={{ fontFamily: option.family || undefined }}>
        {option.sample}
      </span>
      <span
        dir="rtl"
        className="truncate text-base text-muted-foreground"
        style={{ fontFamily: option.family || undefined }}
      >
        {option.labelAr}
      </span>
    </button>
  )
}
