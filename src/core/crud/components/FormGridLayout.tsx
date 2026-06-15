"use client"

import React from "react"
import { cn } from "@/shared/utils"

export interface FormGridLayoutProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 4 | 6 | 12
  gap?: string
  className?: string
}

/**
 * Form Grid Layout
 *
 * Provides a responsive grid system for form fields.
 * Automatically handles different column counts and breakpoints.
 * Supports field-level column spanning via colSpan prop on children.
 */
export function FormGridLayout({ children, columns = 2, gap = "1.5rem", className }: FormGridLayoutProps) {
  // Map columns to grid-cols classes with responsive breakpoints
  const gridClasses: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
    12: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12",
  }

  return (
    <div className={cn("grid w-full", gridClasses[columns], className)} style={{ gap }}>
      {children}
    </div>
  )
}
