"use client"

/**
 * A flat, token-styled collapsible section used to keep the dense Colors and
 * Components tabs navigable. The polished header toggles an open/closed body
 * with a rotating chevron and an optional count/summary pill. RTL-correct
 * (logical props; the chevron mirrors via rtl:rotate-180 when open).
 */

import { useState } from "react"
import { ChevronDown } from "lucide-react"

interface CollapsibleSectionProps {
  title: string
  hint?: string
  /** Optional short summary shown on the end of the header (e.g. a count). */
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  hint,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps): React.ReactNode {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-accent/5"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {summary && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {summary}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  )
}
