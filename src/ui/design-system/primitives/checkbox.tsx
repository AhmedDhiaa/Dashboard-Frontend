"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

/**
 * CHECKBOX COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * Supports all states: default, hover, focus, checked, disabled.
 *
 * @strict @enterprise-grade
 */

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "checkbox"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-[var(--checkbox-root-radius,0.375rem)] border border-primary bg-background",
        "transition-all duration-200",
        "ring-offset-background",
        "hover:border-primary/80 hover:bg-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
        styles.root,
        className,
      )}
      style={{ ...inline, ...props.style }}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
