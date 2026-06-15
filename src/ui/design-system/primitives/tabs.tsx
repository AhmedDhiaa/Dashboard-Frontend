/**
 * TABS COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * NO hardcoded dark mode classes.
 * Enhanced active states and transitions.
 *
 * @strict @enterprise-grade
 */

"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-2", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const { settings } = useTheme()
  const componentId = "tabs"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // Segmented-control look: muted container, white "pill" on the
        // active tab. Cleaner than an underline-tab system at narrow
        // widths — the pill survives in mobile drawer headers.
        "inline-flex h-10 items-center justify-center rounded-lg p-1 gap-1",
        "bg-muted/70 text-muted-foreground",
        styles.list,
        className,
      )}
      style={{ ...inline, ...props.style }}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { settings } = useTheme()
  const componentId = "tabs"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3.5 py-1",
        "text-sm font-medium whitespace-nowrap text-muted-foreground",
        "transition-all duration-150",
        "hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-50",
        // Active state: solid card surface lifts the pill out of the
        // muted track. shadow-sm gives a 1px elevation cue.
        "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        styles.trigger,
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none mt-2", className)} {...props} />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
