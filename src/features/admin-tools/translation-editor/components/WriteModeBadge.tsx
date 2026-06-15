"use client"

/**
 * Tiny visual cue telling the admin whether their edits land in source files
 * (committed via git) or in the runtime override store (per-deploy state).
 *
 * The mode is decided at client-bundle build time via NEXT_PUBLIC_APP_-
 * ALLOW_RUNTIME_CODEGEN, so a single static badge is correct for the whole
 * session — no re-renders, no race with a server-side flip.
 */

import { FileEdit, Layers } from "lucide-react"
import { WRITE_MODE } from "../lib/write-mode"

interface WriteModeBadgeProps {
  /** Compact pill suitable for sitting next to a panel title. */
  size?: "sm" | "md"
}

export function WriteModeBadge({ size = "md" }: WriteModeBadgeProps): React.ReactNode {
  const isSource = WRITE_MODE === "source"
  const Icon = isSource ? FileEdit : Layers
  const label = isSource ? "Writing to source" : "Writing to overrides"
  // Both modes use semantic tokens; the source-write mode picks the
  // destructive tone since it commits straight to the on-disk source —
  // an admin should notice the higher-blast-radius mode at a glance.
  const tone = isSource
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-primary/10 text-primary border-primary/20"
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  return (
    <span
      title={
        isSource
          ? "Edits commit directly to messages/<locale>/<namespace>.json"
          : "Edits land in messages/_overrides/<locale>.json"
      }
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${tone} ${padding}`}
    >
      <Icon className={iconSize} />
      {label}
    </span>
  )
}
