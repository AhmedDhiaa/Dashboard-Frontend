import * as React from "react"
import { format, startOfDay, endOfDay } from "date-fns"
import { enUS, ar } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { useT, useLocale } from "@/shared/config/i18n"
import type { DatePickerMode } from "./types"

export function useDateRangeLogic({
  value,
  onChange,
  mode,
}: {
  value: DateRange | undefined
  onChange: ((range: DateRange | undefined) => void) | undefined
  mode: DatePickerMode
}) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = React.useCallback(
    (selectedDate: DateRange | undefined) => {
      if (!selectedDate?.from) {
        onChange?.(undefined)
        return
      }
      if (mode === "range") {
        const normalized: DateRange = {
          from: startOfDay(selectedDate.from),
          to: selectedDate.to ? endOfDay(selectedDate.to) : undefined,
        }
        onChange?.(normalized)
      } else {
        const normalized: DateRange = {
          from: startOfDay(selectedDate.from),
          to: endOfDay(selectedDate.from),
        }
        onChange?.(normalized)
        if (open) setOpen(false)
      }
    },
    [onChange, mode, open],
  )

  const t = useT("common")
  const { locale } = useLocale()
  const dateLocale = locale === "ar" ? ar : enUS

  const displayText = React.useMemo(() => {
    if (!value?.from) return t("pick_range")
    const formatStr = mode === "range" ? "MMM dd, yyyy" : "PPP"
    if (mode === "range") {
      if (value.from && value.to) {
        const fromStr = format(value.from, formatStr, { locale: dateLocale })
        const toStr = format(value.to, formatStr, { locale: dateLocale })
        return `${fromStr}  →  ${toStr}`
      } else if (value.from) {
        const fromStr = format(value.from, formatStr, { locale: dateLocale })
        return `${fromStr}  →  ${t("select_end_date")}`
      }
    }
    return format(value.from, "PPP", { locale: dateLocale })
  }, [value, mode, t, dateLocale])

  return { open, setOpen, handleSelect, displayText }
}
