import type { DateRange } from "react-day-picker"
import type * as React from "react"

export type DatePickerMode = "day" | "month" | "year" | "range"

export interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  mode?: DatePickerMode
  placeholder?: string
  className?: string
  disabled?: boolean
  showShortcuts?: boolean
  children?: React.ReactNode
}

export interface DateShortcut {
  label: string
  getValue: () => DateRange
  type: string
}
