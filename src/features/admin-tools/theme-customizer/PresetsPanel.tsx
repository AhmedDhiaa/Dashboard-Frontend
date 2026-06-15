"use client"

/**
 * Template gallery ("suggest models") — the headline examples feature.
 *
 * Each card previews a complete, coherent palette via a multi-swatch strip
 * (primary / accent / success / destructive / background / card), its name and
 * a short description, and an Apply button that MERGES the template's full token
 * map into the draft.
 */

import { Check } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { THEME_TEMPLATES, TEMPLATE_PREVIEW_KEYS, type ThemeTemplate } from "./token-catalog"

interface PresetsPanelProps {
  onApply: (tokens: Record<string, string>) => void
  /** The current draft, used to highlight a fully-applied template. */
  draft: Record<string, string>
}

/** True when every token in the template currently matches the draft. */
function isApplied(template: ThemeTemplate, draft: Record<string, string>): boolean {
  return Object.entries(template.tokens).every(([k, v]) => draft[k] === v)
}

export function PresetsPanel({ onApply, draft }: PresetsPanelProps): React.ReactNode {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {THEME_TEMPLATES.map(template => (
        <TemplateCard
          key={template.id}
          template={template}
          applied={isApplied(template, draft)}
          onApply={() => onApply(template.tokens)}
        />
      ))}
    </div>
  )
}

function TemplateCard({ template, applied, onApply }: { template: ThemeTemplate; applied: boolean; onApply: () => void }) {
  return (
    <div
      className={`group flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md ${applied ? "border-primary ring-1 ring-primary" : "border-border hover:border-border/70"}`}
    >
      <SwatchStrip template={template} />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{template.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{template.description}</p>
        </div>
        {applied && (
          <span title="Applied" className="mt-0.5 shrink-0">
            <Check className="h-4 w-4 text-primary" aria-label="Applied" />
          </span>
        )}
      </div>

      <Button onClick={onApply} variant={applied ? "secondary" : "outline"} size="sm" className="mt-auto w-full">
        {applied ? "Applied" : "Apply template"}
      </Button>
    </div>
  )
}

function SwatchStrip({ template }: { template: ThemeTemplate }) {
  return (
    <div className="flex h-9 overflow-hidden rounded-lg border border-border shadow-sm">
      {TEMPLATE_PREVIEW_KEYS.map(key => {
        const color = template.tokens[key]
        if (!color) return <span key={key} className="flex-1 bg-muted" />
        return <span key={key} className="flex-1 transition-[flex] group-hover:first:flex-[1.4]" style={{ backgroundColor: color }} title={key} />
      })}
    </div>
  )
}
