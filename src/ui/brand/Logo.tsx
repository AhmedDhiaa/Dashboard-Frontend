/**
 * Brand logo — a white-label, asset-free SVG mark.
 *
 * No raster images: the mark is an inline SVG drawn in `currentColor`, sitting
 * on a `bg-primary` tile, so it themes automatically (light/dark, any primary
 * color) and scales crisply at every size. Swap the glyph here to rebrand the
 * whole app in one place; the wordmark reads from `APP_NAME`.
 */

import { cn } from "@/shared/utils"
import { APP_NAME } from "@/shared/config/brand"

/** The mark glyph — an ascending bar motif (analytics / dashboard). */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="4" y="12" width="4" height="8" rx="1.5" />
      <rect x="10" y="7" width="4" height="13" rx="1.5" />
      <rect x="16" y="3" width="4" height="17" rx="1.5" />
    </svg>
  )
}

/**
 * The brand tile — a primary-colored rounded square holding the glyph. Size it
 * with `className` (e.g. `size-9`); the glyph scales to the tile automatically.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden="true"
    >
      <BrandGlyph className="size-[58%]" />
    </span>
  )
}

/** The full lockup — mark + `APP_NAME` wordmark. */
export function BrandLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className={cn("size-9", markClassName)} />
      <span className="text-base font-semibold tracking-tight text-foreground">{APP_NAME}</span>
    </span>
  )
}
