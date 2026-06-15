"use client"

import * as React from "react"
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/shared/utils"
import { useT } from "@/shared/config/i18n"

/**
 * Date range picker trigger button.
 *
 * Design intent: looks like the Input + Select primitives, not a marketing
 * pill. The previous iteration was h-12/h-14 (48–56 px tall) with a 32-36 px
 * icon tile and a 28-32 px destructive-tinted clear button — fine standalone,
 * but in a toolbar next to h-10 Input/Select controls the trigger towered
 * over its neighbours.
 *
 * Now h-10 (matches Input/Select), rounded-lg, single-bordered, focus ring
 * keyed to the same `ring-ring/40` tokens. The inline clear `X` is a 5×5
 * muted hover button — affordance without destructive-red shouting.
 */
export const TriggerButton = React.forwardRef<
  HTMLButtonElement,
  {
    value: DateRange | undefined
    disabled: boolean | undefined
    open: boolean
    displayText: string
    onChange: ((range: DateRange | undefined) => void) | undefined
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange">
>(({ value, disabled, open, displayText, onChange, className, ...props }, ref) => {
  const t = useT("common")
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={cn(
        "group inline-flex items-center gap-2 h-10 w-full px-3 rounded-lg text-sm text-start",
        "border border-border bg-card text-foreground",
        "transition-colors duration-150",
        "hover:bg-muted/40 hover:border-border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
        !value && "text-muted-foreground/80",
        open && "ring-2 ring-ring/40 border-ring",
        className,
      )}
      aria-label={displayText}
      {...props}
    >
      <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate text-sm">{displayText}</span>
      {value && !disabled && (
        // Inline clear "X" — neutral hover affordance, not a destructive
        // pill. stopPropagation so the click clears the value rather than
        // opening the popover.
        <span
          role="button"
          tabIndex={0}
          className="inline-flex items-center justify-center h-5 w-5 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          onClick={e => {
            e.stopPropagation()
            onChange?.(undefined)
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation()
              onChange?.(undefined)
            }
          }}
          aria-label={t("clear_selection")}
        >
          <X className="h-3.5 w-3.5" />
        </span>
      )}
      <ChevronDown
        className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0", open && "rotate-180")}
        aria-hidden="true"
      />
    </button>
  )
})
TriggerButton.displayName = "TriggerButton"
