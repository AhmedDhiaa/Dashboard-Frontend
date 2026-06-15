"use client"

/**
 * The studio's section navigation — a single clean horizontal pill bar that
 * spans the full width above the workspace (Vercel/Linear settings style). It
 * wraps on narrow screens rather than stealing width from the controls column,
 * which kept the controls cramped when it was a vertical side-rail.
 *
 * Built on the design-system Tabs primitive so it shares active-state styling
 * and keyboard behaviour; this file only re-skins the list + triggers.
 */

import {
  Blocks,
  LayoutTemplate,
  Palette,
  Sparkles,
  SunMoon,
  Type,
  Ruler,
  type LucideIcon,
} from "lucide-react"
import { TabsList, TabsTrigger } from "@/ui/design-system/primitives/tabs"
import { cn } from "@/shared/utils"

export interface StudioTab {
  value: string
  label: string
  icon: LucideIcon
}

export const STUDIO_TABS: StudioTab[] = [
  { value: "templates", label: "Templates", icon: LayoutTemplate },
  { value: "colors", label: "Colors", icon: Palette },
  { value: "typography", label: "Typography", icon: Type },
  { value: "shape", label: "Shape & Size", icon: Ruler },
  { value: "components", label: "Components", icon: Blocks },
  { value: "effects", label: "Effects", icon: Sparkles },
  { value: "mode", label: "Mode", icon: SunMoon },
]

const TRIGGER = cn(
  "h-9 shrink-0 gap-2 rounded-lg px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
  "data-[state=active]:border data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
)

export function TabNav(): React.ReactNode {
  return (
    <TabsList className="flex h-auto w-full flex-wrap items-center justify-start gap-1.5 bg-transparent p-0">
      {STUDIO_TABS.map(tab => (
        <TabsTrigger key={tab.value} value={tab.value} className={TRIGGER}>
          <tab.icon className="h-4 w-4" />
          {tab.label}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
