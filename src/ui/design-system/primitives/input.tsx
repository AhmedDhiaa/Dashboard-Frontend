"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

/**
 * Input — single-line text control.
 *
 * Design tone: enterprise / official. Decisions:
 *   - h-10 (40 px): matches the Button default size. A form row with
 *     "input + button" therefore aligns on the baseline at every zoom.
 *   - rounded-lg (8 px): tighter than the legacy rounded-xl (12 px).
 *     12 px reads as a marketing pill; 8 px reads as a data-entry field.
 *   - Solid bg-background: the previous bg-background/50 + backdrop-blur
 *     bled the page beneath through the field, hurting legibility on
 *     dense forms. Glass effects are reserved for floating layers.
 *   - Single-color focus ring (no decorative ::after glow div): the
 *     extra layer was a fight with accessibility tooling — focus is
 *     communicated by the border + ring, not a separate animation.
 *   - transition-colors duration-150: text-field interactions should
 *     feel instant. 300 ms felt sluggish during data entry.
 *   - placeholder muted to 60 % so it doesn't compete with the entered
 *     value visually.
 *
 * NO hardcoded colors — every state pulls from design tokens (border,
 * background, foreground, primary, destructive). The ThemeCustomizer
 * still wires through `resolveStyles` / `resolveInlineStyles` so admin
 * overrides at runtime take effect on top of these defaults.
 *
 * @strict @enterprise-grade
 */

import * as React from "react"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, error, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "input"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  // Normalize a *controlled* value (null/undefined → "") so a controlled
  // input never silently flips to uncontrolled. But when the caller passes
  // no `value` prop at all, the field is uncontrolled (defaultValue / ref);
  // forcing value="" there would make it read-only and fire React's
  // "you provided a `value` prop without an `onChange` handler" warning. So
  // only inject `value` when the caller is actually controlling the field.
  const isControlled = "value" in props

  return (
    <input
      type={type}
      className={cn(
        "flex h-[var(--input-root-height,2.5rem)] w-full rounded-[var(--input-root-radius,0.5rem)] border border-border bg-background px-3 py-2",
        "text-sm text-foreground placeholder:text-muted-foreground/60",
        "transition-colors duration-150",
        "hover:border-border/80",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
        "read-only:bg-muted/30 read-only:cursor-default read-only:hover:border-border",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        error && "border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive",
        styles.root,
        className,
      )}
      style={{ ...inline, ...props.style }}
      ref={ref}
      aria-invalid={error}
      {...props}
      {...(isControlled ? { value: props.value ?? "" } : {})}
    />
  )
})
Input.displayName = "Input"

export { Input }
