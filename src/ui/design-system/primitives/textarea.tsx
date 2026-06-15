"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

/**
 * TEXTAREA COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * NO hardcoded dark mode classes or colors.
 * Supports all states: default, hover, focus, error, disabled, readonly.
 *
 * @strict @enterprise-grade
 */

import * as React from "react"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, error, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "textarea"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  const value = props.value === null || props.value === undefined ? "" : props.value

  return (
    <textarea
      className={cn(
        // Matches Input but with min-height for multi-line. Same rounded-lg,
        // same border, same focus ring — so a form mixing Input + Textarea
        // reads as a single field family. resize-y so the user can grow
        // the field for long bodies; resize-x is disabled (would let the
        // field escape the form grid).
        "flex min-h-[88px] w-full rounded-[var(--textarea-root-radius,0.5rem)] border border-border bg-background px-3 py-2.5",
        "text-sm text-foreground placeholder:text-muted-foreground/60",
        "transition-colors duration-150 resize-y",
        "hover:border-border/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
        "read-only:bg-muted/30 read-only:cursor-default read-only:hover:border-border",
        error && "border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive",
        styles.root,
        className,
      )}
      style={{ ...inline, ...props.style }}
      ref={ref}
      aria-invalid={error}
      {...props}
      value={value}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
