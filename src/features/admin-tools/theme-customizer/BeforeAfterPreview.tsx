"use client"

/**
 * The before/after preview surfaces — the headline feature of the studio.
 *
 * "Current (live)" pins EVERY edited token back to its published `live` value,
 * so it always shows the live look regardless of the global draft preview that
 * `useDraftPreview` writes onto documentElement. "After your edits" applies the
 * `draft` token map. Both wrappers carry explicit inline CSS variables so the
 * comparison is reliable and independent of the surrounding chrome.
 *
 * `view` selects what to render: side-by-side (default), or a single pane —
 * driven by the segmented toggle in PreviewFrame. The token-pinning logic is
 * identical across views.
 */

import type { CSSProperties } from "react"
import { ThemeSample } from "./ThemeSample"

export type PreviewView = "split" | "current" | "after"

interface BeforeAfterPreviewProps {
  live: Record<string, string>
  draft: Record<string, string>
  view?: PreviewView
}

/** Keys that differ between draft and live (in either direction). */
function editedKeys(live: Record<string, string>, draft: Record<string, string>): string[] {
  const keys = new Set([...Object.keys(live), ...Object.keys(draft)])
  return [...keys].filter(k => (live[k] ?? "") !== (draft[k] ?? ""))
}

/** Build an inline-style object of `--token: value` entries from a map. */
function toStyle(tokens: Record<string, string>, keys: string[]): CSSProperties {
  const style: Record<string, string> = {}
  for (const k of keys) {
    const value = tokens[k]
    if (value) style[k] = value
  }
  return style as CSSProperties
}

export function BeforeAfterPreview({ live, draft, view = "split" }: BeforeAfterPreviewProps): React.ReactNode {
  const edited = editedKeys(live, draft)
  // Live side: pin only the edited tokens back to their live values so the
  // global draft preview can't bleed into it. Draft side: apply the whole map.
  const liveStyle = toStyle(live, edited)
  const draftStyle = toStyle(draft, Object.keys(draft))

  if (view === "current") return <PreviewPane label="Current (live)" tone="muted" style={liveStyle} />
  if (view === "after") return <PreviewPane label="After your edits" tone="primary" style={draftStyle} />

  // Stack vertically so each pane gets the FULL preview width and stays
  // readable — side-by-side squeezed the rich sample on the narrower pane.
  return (
    <div className="space-y-5">
      <PreviewPane label="After your edits" tone="primary" style={draftStyle} />
      <div className="border-t border-dashed border-border" />
      <PreviewPane label="Current (live)" tone="muted" style={liveStyle} />
    </div>
  )
}

function PreviewPane({ label, tone, style }: { label: string; tone: "muted" | "primary"; style: CSSProperties }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${tone === "primary" ? "bg-primary" : "bg-muted-foreground/50"}`}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div style={style}>
        <ThemeSample />
      </div>
    </div>
  )
}
