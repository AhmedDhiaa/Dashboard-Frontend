"use client"

import React from "react"

export interface SplitFormLayoutProps {
  /** Content for the left column (form fields in LTR, right in RTL) */
  leftContent: React.ReactNode
  /** Content for the right column (map/preview in LTR, left in RTL) */
  rightContent: React.ReactNode
  /** Left column width (default: "70%") */
  leftWidth?: string
  /** Right column width (default: "30%") */
  rightWidth?: string
  /** Gap between columns (default: "1.5rem") */
  gap?: string
  /** Stack vertically on mobile (default: true) */
  stackOnMobile?: boolean
  /** Breakpoint for mobile stacking (default: "768px") */
  mobileBreakpoint?: string
}

/**
 * Generic Split Form Layout Component
 *
 * Provides a reusable two-column layout for forms with configurable proportions.
 * Commonly used for forms with maps, image previews, or rich editors alongside standard fields.
 *
 * @example
 * ```tsx
 * <SplitFormLayout
 *   leftContent={<SchemaFormRenderer fields={leftFields} />}
 *   rightContent={<BoundariesField variant="embedded" />}
 *   leftWidth="30%"
 *   rightWidth="70%"
 * />
 * ```
 */
export function SplitFormLayout({
  leftContent,
  rightContent,
  leftWidth = "70%",
  rightWidth = "30%",
  stackOnMobile = true,
  mobileBreakpoint = "768px",
}: SplitFormLayoutProps) {
  return (
    <div
      className="split-form-layout w-full"
      style={
        {
          display: "grid",
          // Passing values as CSS variables for the style tag to use
          "--left-width": leftWidth,
          "--right-width": rightWidth,
        } as React.CSSProperties & { [key: string]: string | number }
      }
    >
      <style jsx>{`
        .split-form-layout {
          grid-template-columns: minmax(0, 1fr);
        }
        @media (min-width: ${mobileBreakpoint}) {
          .split-form-layout {
            grid-template-columns: minmax(0, var(--left-width)) minmax(0, var(--right-width));
          }
        }
        ${!stackOnMobile
          ? `
          .split-form-layout {
            grid-template-columns: minmax(0, var(--left-width)) minmax(0, var(--right-width)) !important;
          }
        `
          : ""}
      `}</style>

      {/* Left Column - Form Fields with Premium Card */}
      <div className="split-form-left">
        <div className="p-2">
          <div className="flex flex-col">{leftContent}</div>
        </div>
      </div>

      {/* Right Column - Map/Preview with Premium Card */}
      <div className="split-form-right">
        <div className="p-2">
          <div className="flex-1 min-h-0">{rightContent}</div>
        </div>
      </div>
    </div>
  )
}
