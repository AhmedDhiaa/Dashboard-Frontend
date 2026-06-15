"use client"

/**
 * A subtle inline badge telling the admin where a control's current value
 * comes from — "default" (built-in), or "overridden" (a draft/live override is
 * in effect). Replaces the old "(default)" placeholder so controls always show
 * a real value plus this provenance cue.
 */

interface OriginBadgeProps {
  origin: "default" | "live" | "draft"
  overridden: boolean
}

export function OriginBadge({ origin, overridden }: OriginBadgeProps): React.ReactNode {
  if (origin === "default" && !overridden) {
    return (
      <span className="rounded-full border border-border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        default
      </span>
    )
  }
  return (
    <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-primary">
      overridden
    </span>
  )
}
