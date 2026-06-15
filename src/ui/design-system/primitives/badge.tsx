"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

/**
 * BADGE COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * NO hardcoded colors, borders, shadows, or spacing.
 * All variants reference theme colors for instant theme switching.
 *
 * @strict @enterprise-grade
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

// Badges use a soft-tinted background rather than a saturated fill in the
// default state — saturated badges next to a saturated row hover compete
// for attention. The tinted version (bg-primary/15 text-primary) keeps
// the semantic colour cue without screaming. `solid:true` opts back into
// the high-contrast version for status pills that need to stand out
// (e.g. "Critical", "Failed").
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        secondary: "border-transparent bg-secondary/15 text-secondary-foreground",
        destructive: "border-transparent bg-destructive/12 text-destructive",
        outline: "border-border bg-transparent text-foreground",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        info: "border-transparent bg-info/15 text-info",
        accent: "border-transparent bg-accent/15 text-accent",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const { settings } = useTheme()
  const componentId = "badge"
  const styles = resolveStyles(
    componentId,
    { variant: variant || "default" },
    settings?.components?.[componentId]?.elements,
  )
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  return (
    <div
      className={cn(badgeVariants({ variant }), styles.root, className)}
      style={{ ...inline, ...props.style }}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
