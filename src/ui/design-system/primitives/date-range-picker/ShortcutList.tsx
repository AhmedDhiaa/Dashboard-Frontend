"use client"

import * as React from "react"
import { CalendarRange, Check } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/shared/utils"
import { useT } from "@/shared/config/i18n"
import type { DateShortcut } from "./types"
import { isSameRange } from "./utils"

/**
 * Shortcuts sidebar — a clean, flat list (Linear/Vercel style).
 *
 * Active item: `bg-primary/10 text-primary`. Inactive: `text-foreground`
 * with `hover:bg-muted` — the hover surface never swaps the text colour to
 * something that washes the label out, so the label stays readable at every
 * state. The "Custom range" entry is pinned to the bottom (separated by a
 * hairline) and opens the calendar instead of committing a value.
 */
export const ShortcutList = React.memo(
  ({
    shortcuts,
    onSelect,
    setOpen,
    currentValue,
    selectedShortcut,
    setSelectedShortcut,
  }: {
    shortcuts: DateShortcut[]
    onSelect: (date: DateRange | undefined) => void
    setOpen: (open: boolean) => void
    currentValue: DateRange | undefined
    selectedShortcut: string | null
    setSelectedShortcut: (type: string | null) => void
  }) => {
    const t = useT("common")

    const presets = shortcuts.filter(s => s.type !== "custom")
    const custom = shortcuts.find(s => s.type === "custom")
    const customActive = selectedShortcut === "custom"

    return (
      <div className="w-full sm:w-48 lg:w-52 flex flex-col bg-muted/20 border-b sm:border-b-0 sm:border-e border-border">
        <p className="px-3 pt-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("quick_select")}
        </p>
        <div className="px-2 pb-2 grid grid-cols-2 sm:grid-cols-1 gap-0.5">
          {presets.map(shortcut => {
            const isActive =
              selectedShortcut === shortcut.type ||
              (selectedShortcut === null && isSameRange(currentValue, shortcut.getValue()))
            return (
              <button
                key={shortcut.label}
                type="button"
                className={cn(
                  "group flex w-full items-center justify-between gap-2 rounded-md px-2.5 h-8 text-sm text-start transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => {
                  const val = shortcut.getValue()
                  onSelect(val)
                  setSelectedShortcut(shortcut.type)
                  setOpen(false)
                }}
              >
                <span className="truncate">{shortcut.label}</span>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        {custom && (
          <div className="mt-auto px-2 pt-2 pb-2 border-t border-border">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 h-8 text-sm text-start transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                customActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted",
              )}
              onClick={() => setSelectedShortcut("custom")}
            >
              <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{custom.label}</span>
            </button>
          </div>
        )}
      </div>
    )
  },
)
ShortcutList.displayName = "ShortcutList"
