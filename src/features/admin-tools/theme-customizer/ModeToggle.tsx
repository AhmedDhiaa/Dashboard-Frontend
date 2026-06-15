"use client"

/**
 * Light / Dark / System segmented toggle, backed by next-themes. Independent
 * of the token draft — it flips the active color scheme so the admin can
 * preview their edits in both modes.
 *
 * `compact` shrinks it to an icon-only segmented control (used in the preview
 * frame's chrome strip); the default form keeps the icon + label.
 */

import { Monitor, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/shared/utils"

const MODES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const

export function ModeToggle({ compact = false }: { compact?: boolean }): React.ReactNode {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const active = mounted ? theme : undefined

  return (
    <div className={cn("inline-flex border border-border bg-card", compact ? "rounded-lg p-0.5" : "rounded-xl p-1")}>
      {MODES.map(mode => {
        const Icon = mode.icon
        const selected = active === mode.id
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => setTheme(mode.id)}
            aria-pressed={selected}
            aria-label={mode.label}
            title={mode.label}
            className={cn(
              "inline-flex items-center gap-2 font-medium transition-colors",
              compact ? "rounded-md px-2 py-1 text-xs" : "rounded-lg px-3.5 py-1.5 text-sm",
              selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            {!compact && mode.label}
          </button>
        )
      })}
    </div>
  )
}
