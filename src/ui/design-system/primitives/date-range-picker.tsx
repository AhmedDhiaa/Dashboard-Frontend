"use client"

import { cn } from "@/shared/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/design-system/primitives/popover"

import type { DatePickerMode, DateRangePickerProps } from "./date-range-picker/types"
import { useDateRangeLogic } from "./date-range-picker/useDateRangeLogic"
import { TriggerButton } from "./date-range-picker/TriggerButton"
import { ResponsiveCalendarContent } from "./date-range-picker/PickerContent"

export type { DatePickerMode, DateRangePickerProps }

export function DateRangePicker({
  value,
  onChange,
  mode = "range",
  placeholder: _placeholder,
  className,
  disabled,
  showShortcuts = true,
  children,
}: DateRangePickerProps) {
  const { open, setOpen, handleSelect, displayText } = useDateRangeLogic({
    value,
    onChange,
    mode,
  })

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {children || (
            <TriggerButton
              value={value}
              disabled={disabled}
              open={open}
              displayText={displayText}
              onChange={onChange}
            />
          )}
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden z-[100]"
          align="start"
          sideOffset={6}
        >
          <ResponsiveCalendarContent
            date={value}
            showShortcuts={showShortcuts}
            onSelect={handleSelect}
            setOpen={setOpen}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
