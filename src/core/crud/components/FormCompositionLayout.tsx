"use client"

import React from "react"
import { cn } from "@/shared/utils"
import { useT } from "@/shared/config"
import { FormGridLayout } from "./FormGridLayout"
import type { LucideIcon } from "lucide-react"

/**
 * Form Composition Row Definition
 * Supports flexible column counts and field spanning
 */
export interface FormCompositionRow {
  id: string
  title?: string
  titleKey?: string
  icon?: LucideIcon
  children: React.ReactNode
  /** Base column count for this row (1-12) */
  columns?: 1 | 2 | 3 | 4 | 6 | 12
  /** Custom gap between fields */
  gap?: string
  className?: string
}

export interface FormCompositionLayoutProps {
  rows: FormCompositionRow[]
  gap?: string
  className?: string
}

/**
 * Form Composition Layout
 *
 * Advanced layout system supporting:
 * - Dynamic row-by-row column configurations
 * - Field-level column spanning (via colSpan in field config)
 * - 12-column grid system for maximum flexibility
 * - Responsive breakpoints with graceful degradation
 * - Full RTL/LTR support
 *
 * @example
 * ```tsx
 * <FormCompositionLayout rows={[
 *   { id: "row1", columns: 4, children: <Fields for 4-column row> },
 *   { id: "row2", columns: 2, children: <Fields for 2-column row> }
 * ]} />
 * ```
 */
export function FormCompositionLayout({ rows, gap = "1.5rem", className }: FormCompositionLayoutProps) {
  const t = useT()

  if (!rows.length) return null

  return (
    <div className={cn("w-full flex flex-col", className)} style={{ gap }}>
      {rows.map(row => (
        <FormCompositionRow key={row.id} row={row} t={t} />
      ))}
    </div>
  )
}

/**
 * Individual Row Renderer.
 *
 * Delegates the grid logic to `FormGridLayout` rather than duplicating the
 * tailwind responsive class map. The two used to drift independently —
 * unified as part of Phase 0 dedup work.
 */
function FormCompositionRow({ row, t }: { row: FormCompositionRow; t: (key: string) => string }) {
  return (
    <div className={cn("w-full", row.className)}>
      {/* Optional Row Header */}
      {(row.title || row.titleKey) && (
        <div className="flex items-center gap-3 mb-4">
          {row.icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <row.icon className="h-5 w-5" />
            </div>
          )}
          <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
            {row.titleKey ? t(row.titleKey) : row.title}
          </h4>
        </div>
      )}

      <FormGridLayout columns={row.columns || 2} gap={row.gap || "1.5rem"}>
        {row.children}
      </FormGridLayout>
    </div>
  )
}
