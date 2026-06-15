"use client"

import { cn } from "@/shared/utils"

interface ShowcaseBlockProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * Labelled card wrapper for one component variant. Mirrors the visual
 * grammar of the other showcase sub-pages (h3 uppercase tracking, bordered
 * card body) so the mega-page reads consistently with the per-section pages.
 */
function ShowcaseBlock({ title, description, children, className }: ShowcaseBlockProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
        {description && <p className="text-xs text-muted-foreground/80">{description}</p>}
      </div>
      <div className={cn("rounded-lg border bg-card p-6", className)}>{children}</div>
    </div>
  )
}

export default ShowcaseBlock
