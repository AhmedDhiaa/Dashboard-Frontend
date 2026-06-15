"use client"

import React, { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/ui/design-system/primitives/card"
import { useT } from "@/shared/config"
import { FormGridLayout } from "./FormGridLayout"
import { cn } from "@/shared/utils"
import type { LucideIcon } from "lucide-react"

export interface FormSectionDef {
  id: string
  title?: string
  titleKey?: string
  description?: string
  icon?: LucideIcon
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
  /** Allow the section body to be folded under its header. Off by default. */
  collapsible?: boolean
  /** Initial state when `collapsible` is true. Defaults to open. */
  defaultOpen?: boolean
}

export interface SectionedFormLayoutProps {
  sections: FormSectionDef[]
  gap?: string
  className?: string
}

/**
 * Sectioned Form Layout
 *
 * Renders multiple form sections as distinct cards. Each section handles
 * its own grid layout for internal fields. Sections may opt into a
 * collapsible header — body shows/hides on click; default is always-open
 * which preserves the legacy behaviour for every existing caller.
 */
export function SectionedFormLayout({ sections, gap = "1.5rem", className }: SectionedFormLayoutProps) {
  const t = useT()

  return (
    <div
      className={cn("w-full flex flex-col items-stretch max-w-5xl mx-auto px-2 md:px-4 py-4 md:py-8", className)}
      style={{ gap }}
    >
      {sections.map(section => (
        <Section key={section.id} section={section} t={t} />
      ))}
    </div>
  )
}

function Section({ section, t }: { section: FormSectionDef; t: (key: string) => string }) {
  const [isOpen, setIsOpen] = useState(section.defaultOpen ?? true)
  const showBody = !section.collapsible || isOpen

  const headerInteractive = !!section.collapsible

  return (
    <Card
      className={cn(
        "group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors duration-200 hover:border-foreground/15",
        section.className,
      )}
    >
      {(section.title || section.titleKey) && (
        <CardHeader
          icon={
            section.icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <section.icon className="h-[18px] w-[18px]" />
              </div>
            )
          }
          className={cn(
            "py-4 md:py-5 border-b border-border",
            headerInteractive && "cursor-pointer select-none",
          )}
          {...(headerInteractive
            ? {
                role: "button",
                tabIndex: 0,
                "aria-expanded": isOpen,
                onClick: () => setIsOpen(prev => !prev),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setIsOpen(prev => !prev)
                  }
                },
              }
            : {})}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base md:text-lg font-semibold tracking-tight text-foreground">
                {section.titleKey ? t(section.titleKey) : section.title}
              </CardTitle>
              {section.description && (
                <CardDescription className="text-xs md:text-sm text-muted-foreground">
                  {section.description}
                </CardDescription>
              )}
            </div>
            {section.collapsible && (
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-5 w-5 mt-1 text-foreground/60 transition-transform duration-300",
                  !isOpen && "-rotate-90",
                )}
              />
            )}
          </div>
        </CardHeader>
      )}
      {showBody && (
        <CardContent className="p-4 md:p-6">
          <FormGridLayout columns={section.columns || 2} gap="1.25rem">
            {section.children}
          </FormGridLayout>
        </CardContent>
      )}
    </Card>
  )
}
