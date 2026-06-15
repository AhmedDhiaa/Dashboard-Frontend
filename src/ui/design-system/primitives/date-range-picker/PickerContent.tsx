"use client"

import * as React from "react"
import { enUS, ar } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { cn } from "@/shared/utils"
import { Button } from "@/ui/design-system/primitives/button"
import { Calendar } from "@/ui/design-system/primitives/calendar"
import { useT, useLocale } from "@/shared/config/i18n"
import { ShortcutList } from "./ShortcutList"
import { ActiveRangeDisplay } from "./ActiveRangeDisplay"
import { useDateShortcuts } from "./useDateShortcuts"

/**
 * Flat calendar classNames — overrides the design-system Calendar's glassy
 * defaults (gradients, oversized radius, glow shadows) with a clean
 * Linear/Vercel surface. Crucially this makes the RANGE obvious:
 *
 *   - range_start / range_end : solid `bg-primary` chips (the anchors).
 *   - range_middle            : soft `bg-primary/10` with `text-primary`,
 *                               square sides so the run reads as one band.
 *   - selected (single)       : solid `bg-primary` chip.
 *
 * `dir`/RTL flow is handled by the Calendar primitive itself (it sets
 * `dir` + flips the chevrons), so months and arrows order correctly in
 * Arabic without extra work here.
 */
const flatCalendarClassNames = {
  months: "flex flex-col sm:flex-row gap-4 sm:gap-6",
  month: "space-y-3",
  month_caption: "flex justify-between pt-0.5 relative items-center mb-3 px-1",
  caption_label: "text-sm font-medium text-foreground",
  dropdowns: "flex items-center gap-2",
  dropdown:
    "flex focus:outline-none appearance-none bg-card border border-border rounded-md px-2 py-1 cursor-pointer font-medium text-sm hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
  nav: "flex items-center gap-1",
  button_previous:
    "h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-card p-0 text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  button_next:
    "h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-card p-0 text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  weekdays: "grid grid-cols-7 mb-1",
  weekday: "text-muted-foreground font-medium text-xs text-center flex items-center justify-center h-8 w-9",
  week: "grid grid-cols-7",
  day: cn(
    "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center transition-colors",
    // In-between days get a soft band on the CELL. The start/end cells round
    // their outer corners via range_start/range_end below; a band that wraps
    // to a new week also rounds at the row edges so it never looks clipped.
    "[&:has([aria-selected])]:bg-primary/10",
    "first:[&:has([aria-selected])]:rounded-s-md last:[&:has([aria-selected])]:rounded-e-md",
  ),
  day_button:
    "h-9 w-9 p-0 font-normal rounded-md inline-flex items-center justify-center hover:bg-muted aria-selected:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 transition-colors",
  // Start / end anchors: solid primary chips. The chip styling lives ONLY on
  // the range_start / range_end modifiers — never on `selected` — so it can't
  // collide with range_middle on the in-between cells (a middle cell carries
  // both `selected` and `range_middle`, and class concatenation order is not
  // guaranteed). A lone `from` (no `to` yet) is itself a range_start, so the
  // start chip still renders for single-click selections.
  range_start:
    "day-range-start rounded-s-md [&>button]:!bg-primary [&>button]:!text-primary-foreground [&>button]:hover:!bg-primary [&>button]:!font-medium [&>button]:rounded-md",
  range_end:
    "day-range-end rounded-e-md [&>button]:!bg-primary [&>button]:!text-primary-foreground [&>button]:hover:!bg-primary [&>button]:!font-medium [&>button]:rounded-md",
  selected: "",
  // In-between days: keep the soft band, primary-tinted text, no extra chip.
  range_middle:
    "[&>button]:!bg-transparent [&>button]:!text-primary [&>button]:hover:!bg-primary/15 [&>button]:!rounded-none [&>button]:!font-normal",
  today: "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-border [&>button]:font-medium",
  outside: "text-muted-foreground/40 [&>button]:hover:bg-muted/60",
  disabled: "text-muted-foreground/30 cursor-not-allowed",
  hidden: "invisible",
} as const

function useResponsiveMonths() {
  const [months, setMonths] = React.useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2,
  )
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)")
    const update = () => setMonths(mql.matches ? 2 : 1)
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])
  return months
}

export const PickerContent = React.memo(
  ({
    date,
    showShortcuts,
    onSelect,
    setOpen,
  }: {
    date: DateRange | undefined
    showShortcuts: boolean
    onSelect: (date: DateRange | undefined) => void
    setOpen: (open: boolean) => void
  }) => {
    const t = useT("common")
    const { locale } = useLocale()
    const dateLocale = locale === "ar" ? ar : enUS
    const [selectedShortcut, setSelectedShortcut] = React.useState<string | null>(null)
    const shortcuts = useDateShortcuts()
    const numberOfMonths = useResponsiveMonths()
    const showCalendar = selectedShortcut === "custom" || !showShortcuts

    return (
      <div className="flex flex-col sm:flex-row bg-popover">
        {showShortcuts && (
          <ShortcutList
            shortcuts={shortcuts}
            onSelect={onSelect}
            setOpen={setOpen}
            currentValue={date}
            selectedShortcut={selectedShortcut}
            setSelectedShortcut={setSelectedShortcut}
          />
        )}
        {showCalendar && (
          <div className="flex flex-col flex-1 min-w-0">
            <ActiveRangeDisplay date={date} onClear={() => onSelect(undefined)} />
            <div className="flex-1 p-3 flex items-start justify-center overflow-auto">
              <Calendar
                mode="range"
                captionLayout="dropdown"
                startMonth={new Date(new Date().getFullYear() - 10, 0)}
                endMonth={new Date(new Date().getFullYear() + 20, 11)}
                defaultMonth={date?.from}
                selected={date}
                onSelect={onSelect}
                locale={dateLocale}
                numberOfMonths={numberOfMonths}
                className="p-0"
                classNames={flatCalendarClassNames}
              />
            </div>
            <div className="p-3 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="font-medium px-4 h-9"
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="font-medium px-6 h-9"
                onClick={() => setOpen(false)}
              >
                {t("apply")}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  },
)
PickerContent.displayName = "PickerContent"

export function ResponsiveCalendarContent({
  date,
  showShortcuts,
  onSelect,
  setOpen,
}: {
  date: DateRange | undefined
  showShortcuts: boolean
  onSelect: (date: DateRange | undefined) => void
  setOpen: (open: boolean) => void
}) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return <PickerContent date={date} showShortcuts={showShortcuts} onSelect={onSelect} setOpen={setOpen} />
}
