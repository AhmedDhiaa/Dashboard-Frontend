"use client"

import React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/design-system/primitives/tabs"
import { useT } from "@/shared/config"
import { FormGridLayout } from "./FormGridLayout"
import { useLayout } from "@/ui/layout/LayoutContext"
import { cn } from "@/shared/utils"
import type { LucideIcon } from "lucide-react"

import type { FormCompositionRow } from "./FormCompositionLayout"

export interface FormTabDef {
  id: string
  title?: string
  titleKey?: string
  icon?: LucideIcon
  children: React.ReactNode
  fields?: string[]
  rows?: FormCompositionRow[]
  columns?: 1 | 2 | 3 | 4 | 6 | 12
  className?: string
}

export interface FormTabsLayoutProps {
  tabs: FormTabDef[]
  defaultValue?: string
  gap?: string
  className?: string
}

/**
 * Form Tabs Layout
 *
 * Renders form fields organized into tabs.
 * Each tab handles its own grid layout for internal fields.
 * Features premium glassmorphism styling and smooth transitions.
 * Supports RTL/LTR based on the current locale.
 */
export function FormTabsLayout({ tabs, defaultValue, gap = "2rem", className }: FormTabsLayoutProps) {
  const t = useT()
  const { direction } = useLayout()

  if (!tabs.length) return null

  return (
    <div className={cn("w-full max-w-5xl mx-auto px-4 py-8", className)}>
      <Tabs defaultValue={defaultValue || tabs[0]?.id} dir={direction} className="w-full">
        <TabsList
          className={cn(
            "w-full flex justify-start h-auto p-1 gap-1 mb-6 bg-muted border border-border rounded-lg",
            "overflow-x-auto no-scrollbar",
          )}
        >
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-md transition-colors duration-200",
                "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                "hover:bg-card/60",
                "text-sm font-medium tracking-tight",
              )}
            >
              {tab.icon && <tab.icon className="h-4.5 w-4.5" />}
              <span>{tab.titleKey ? t(tab.titleKey) : tab.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(tab => {
          const hasRows = tab.rows && tab.rows.length > 0
          const content = hasRows ? (
            tab.children
          ) : (
            <FormGridLayout columns={tab.columns || 2} gap={gap}>
              {tab.children}
            </FormGridLayout>
          )

          return (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className={cn(
                "mt-0 outline-none",
                "rounded-xl border border-border bg-card shadow-sm p-5 md:p-6",
                tab.className,
              )}
            >
              {content}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
