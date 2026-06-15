"use client"

import * as React from "react"
import { format } from "date-fns"
import { enUS, ar } from "date-fns/locale"
import { ArrowRight, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/shared/utils"
import { useT, useLocale } from "@/shared/config/i18n"

/**
 * Prominent "from → to" summary above the calendar.
 *
 * Flat surface (no gradients / heavy radius). The arrow is a plain inline
 * glyph that flips automatically in RTL via `rtl:rotate-180`. A neutral
 * clear (X) button lets the user reset the chosen range without leaving the
 * calendar. When only the start is picked, the end slot shows a muted
 * "select end date" hint so the next action is obvious.
 */
export const ActiveRangeDisplay = React.memo(
  ({ date, onClear }: { date: DateRange | undefined; onClear?: () => void }) => {
    const t = useT("common")
    const { locale } = useLocale()
    const dateLocale = locale === "ar" ? ar : enUS

    if (!date?.from) return null

    const fmt = (d: Date) => format(d, "MMM dd, yyyy", { locale: dateLocale })

    return (
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("from")}
            </span>
            <span className="text-sm font-medium text-foreground truncate">{fmt(date.from)}</span>
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" aria-hidden="true" />

          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("to")}
            </span>
            <span
              className={cn(
                "text-sm font-medium truncate",
                date.to ? "text-foreground" : "text-muted-foreground/70",
              )}
            >
              {date.to ? fmt(date.to) : t("select_end_date")}
            </span>
          </div>
        </div>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t("clear_selection")}
            className="inline-flex items-center justify-center h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  },
)
ActiveRangeDisplay.displayName = "ActiveRangeDisplay"
