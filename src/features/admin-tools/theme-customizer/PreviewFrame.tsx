"use client"

/**
 * The preview panel framing — a faux browser window around the live preview.
 *
 * A top "chrome" strip carries the three window dots, a segmented view toggle
 * (Split · Current · After) and the light/dark ModeToggle. Below it, the
 * preview body scrolls internally so the frame fills the workspace height. The
 * actual token-pinned samples are rendered by BeforeAfterPreview — this file
 * only owns the framing and the view switch.
 */

import { useState } from "react"
import { cn } from "@/shared/utils"
import { ModeToggle } from "./ModeToggle"
import { BeforeAfterPreview, type PreviewView } from "./BeforeAfterPreview"
import type { CustomizerState } from "./useCustomizerState"

const VIEWS: { id: PreviewView; label: string }[] = [
  { id: "after", label: "After" },
  { id: "current", label: "Current" },
  { id: "split", label: "Compare" },
]

export function PreviewFrame({ state }: { state: CustomizerState }): React.ReactNode {
  // Default to the single full-width "After" pane (most readable); "Compare"
  // stacks before/after vertically for a side-by-side look without squeezing.
  const [view, setView] = useState<PreviewView>("after")

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <WindowChrome view={view} onViewChange={setView} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4">
        <BeforeAfterPreview live={state.live} draft={state.draft} view={view} />
      </div>
    </div>
  )
}

function WindowChrome({ view, onViewChange }: { view: PreviewView; onViewChange: (v: PreviewView) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <WindowDots />
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Live preview</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ViewToggle view={view} onViewChange={onViewChange} />
        <ModeToggle compact />
      </div>
    </div>
  )
}

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
      <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
      <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
    </div>
  )
}

function ViewToggle({ view, onViewChange }: { view: PreviewView; onViewChange: (v: PreviewView) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="Preview view">
      {VIEWS.map(v => (
        <button
          key={v.id}
          type="button"
          onClick={() => onViewChange(v.id)}
          aria-pressed={view === v.id}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            view === v.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
