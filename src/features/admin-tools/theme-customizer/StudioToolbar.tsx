"use client"

/**
 * The sticky top toolbar of the Theme Studio.
 *
 * Left: the studio identity — an icon tile, the "Theme Studio" title and a
 * compact breadcrumb/subtitle. Right: a live-version status chip with a dirty
 * count, followed by the grouped action cluster (StudioActionBar).
 *
 * Sticks to the top of the studio shell so save/publish is always reachable.
 */

import { Palette } from "lucide-react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { StudioActionBar } from "./StudioActionBar"
import type { CustomizerState } from "./useCustomizerState"

interface StudioToolbarProps {
  state: CustomizerState
  onImportError: (message: string) => void
  onImported: (count: number) => void
}

export function StudioToolbar({ state, onImportError, onImported }: StudioToolbarProps): React.ReactNode {
  return (
    <header className="bg-background">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <StudioIdentity />
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip version={state.version} dirtyCount={state.dirtyCount} />
          <StudioActionBar state={state} onImportError={onImportError} onImported={onImported} />
        </div>
      </div>
    </header>
  )
}

function StudioIdentity() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
        <Palette className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight">Theme Studio</h1>
        <p className="truncate text-xs text-muted-foreground">
          Admin · Appearance · Edit every themeable token, preview, then publish.
        </p>
      </div>
    </div>
  )
}

/** Compact chip: `Live vX` plus a dirty-count badge ("12 unsaved" / "Saved"). */
function StatusChip({ version, dirtyCount }: { version: number; dirtyCount: number }) {
  const dirty = dirtyCount > 0
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card py-1 pe-1.5 ps-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-primary" : "bg-success"}`} aria-hidden />
        Live v{version}
      </span>
      <Badge variant={dirty ? "default" : "muted"} className="px-2 py-0 text-[11px]">
        {dirty ? `${dirtyCount} unsaved` : "Saved"}
      </Badge>
    </div>
  )
}
