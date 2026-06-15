import { startOfDay, endOfDay } from "date-fns"
import type { DateRange } from "react-day-picker"

export function isSameRange(a: DateRange | undefined, b: DateRange | undefined) {
  if (!a || !b) return false
  if (!a.from || !b.from) return false
  return (
    startOfDay(a.from).getTime() === startOfDay(b.from).getTime() &&
    (a.to && b.to ? endOfDay(a.to).getTime() === endOfDay(b.to).getTime() : !a.to && !b.to)
  )
}
