"use client"

import { cn } from "@/shared/utils"

interface ShowcaseSectionProps {
  id: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * Section wrapper for the mega-page. Renders a labelled <section> with a
 * stable id so the sticky-nav anchors resolve, and exposes the h2 as the
 * section's accessible name via aria-labelledby. The wrapping <section>
 * has scroll-margin-top so anchor jumps land below the sticky page header
 * rather than under it.
 */
export function ShowcaseSection({ id, title, description, children, className }: ShowcaseSectionProps) {
  const headingId = `${id}-heading`
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-24 space-y-6 pb-16 border-b border-border/40 last:border-b-0", className)}
    >
      <div className="space-y-1">
        <h2 id={headingId} className="text-2xl font-semibold text-foreground tracking-tight">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  )
}
