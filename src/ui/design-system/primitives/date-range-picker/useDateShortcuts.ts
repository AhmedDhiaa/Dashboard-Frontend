import * as React from "react"
import {
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  endOfDay,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns"

import { useT } from "@/shared/config/i18n"
import type { DateShortcut } from "./types"

export function useDateShortcuts(): DateShortcut[] {
  const t = useT("common")
  return React.useMemo(() => {
    const today = new Date()
    return [
      {
        label: t("today"),
        getValue: () => ({ from: startOfDay(today), to: endOfDay(today) }),
        type: "today",
      },
      {
        label: t("yesterday"),
        getValue: () => ({
          from: startOfDay(subDays(today, 1)),
          to: endOfDay(subDays(today, 1)),
        }),
        type: "yesterday",
      },
      {
        label: t("this_week"),
        getValue: () => ({
          from: startOfWeek(today, { weekStartsOn: 1 }),
          to: endOfWeek(today, { weekStartsOn: 1 }),
        }),
        type: "this_week",
      },
      {
        label: t("last_7_days"),
        getValue: () => ({
          from: startOfDay(subDays(today, 6)),
          to: endOfDay(today),
        }),
        type: "last_7_days",
      },
      {
        label: t("last_30_days"),
        getValue: () => ({
          from: startOfDay(subDays(today, 29)),
          to: endOfDay(today),
        }),
        type: "last_30_days",
      },
      {
        label: t("this_month"),
        getValue: () => ({
          from: startOfDay(startOfMonth(today)),
          to: endOfDay(endOfMonth(today)),
        }),
        type: "this_month",
      },
      {
        label: t("last_month"),
        getValue: () => {
          const lastMonth = subMonths(today, 1)
          return {
            from: startOfDay(startOfMonth(lastMonth)),
            to: endOfDay(endOfMonth(lastMonth)),
          }
        },
        type: "last_month",
      },
      {
        label: t("this_year"),
        getValue: () => ({
          from: startOfDay(startOfYear(today)),
          to: endOfDay(endOfYear(today)),
        }),
        type: "this_year",
      },
      {
        label: t("custom_range"),
        getValue: () => ({ from: undefined as unknown as Date, to: undefined }),
        type: "custom",
      },
    ]
  }, [t])
}
