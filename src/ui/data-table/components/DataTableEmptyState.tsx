/**
 * Contextual empty state for the DataTable.
 *
 * Renders one of three flavors based on the current state:
 *   - `error`            — load failed, offers a retry CTA
 *   - `filtered-empty`   — filters/search applied with no matches, offers "clear filters"
 *   - `empty`            — base case: no data ever existed
 *
 * Accessibility: container is announced via `role="status"` + `aria-live="polite"`
 * so screen readers pick up the state transition.
 */

"use client"

import { Inbox, SearchX, WifiOff, RotateCw } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"

export type DataTableEmptyVariant = "empty" | "filtered-empty" | "error"

interface DataTableEmptyStateProps {
  variant: DataTableEmptyVariant
  t: (key: string) => string
  onClearFilters?: () => void
  onRetry?: () => void
}

interface VariantSpec {
  Icon: typeof Inbox
  iconWrapClass: string
  iconClass: string
  titleKey: string
  descriptionKey: string
  ctaKey?: string
  ctaIcon?: typeof RotateCw
}

const VARIANTS: Record<DataTableEmptyVariant, VariantSpec> = {
  empty: {
    Icon: Inbox,
    iconWrapClass: "bg-muted/30",
    iconClass: "text-muted-foreground/60",
    titleKey: "crud.messages.no_data",
    descriptionKey: "crud.messages.no_data_description",
  },
  "filtered-empty": {
    Icon: SearchX,
    iconWrapClass: "bg-primary/10",
    iconClass: "text-primary",
    titleKey: "crud.messages.no_results",
    descriptionKey: "crud.messages.no_results_description",
    ctaKey: "crud.messages.clear_filters",
  },
  error: {
    Icon: WifiOff,
    iconWrapClass: "bg-destructive/10",
    iconClass: "text-destructive",
    titleKey: "crud.messages.network_error_title",
    descriptionKey: "crud.messages.network_error_description",
    ctaKey: "crud.messages.retry",
    ctaIcon: RotateCw,
  },
}

export function DataTableEmptyState({ variant, t, onClearFilters, onRetry }: DataTableEmptyStateProps) {
  const spec = VARIANTS[variant]
  const onCta = variant === "filtered-empty" ? onClearFilters : variant === "error" ? onRetry : undefined
  const CtaIcon = spec.ctaIcon

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-6 py-8 animate-in fade-in zoom-in-95 duration-500"
    >
      <div className={`h-20 w-20 rounded-3xl flex items-center justify-center shadow-inner ${spec.iconWrapClass}`}>
        <spec.Icon className={`h-10 w-10 ${spec.iconClass}`} aria-hidden="true" />
      </div>

      <div className="space-y-1 text-center">
        <p className="text-base font-bold text-foreground">{t(spec.titleKey)}</p>
        <p className="text-xs text-muted-foreground/70 max-w-[260px] mx-auto">{t(spec.descriptionKey)}</p>
      </div>

      {spec.ctaKey && onCta && (
        <Button variant="outline" size="sm" onClick={onCta} className="gap-2">
          {CtaIcon && <CtaIcon className="h-4 w-4" aria-hidden="true" />}
          {t(spec.ctaKey)}
        </Button>
      )}
    </div>
  )
}
