"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

/**
 * SLIDER COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * NO hardcoded dark mode classes.
 *
 * @strict @enterprise-grade
 */

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "slider"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  // Radix sets `role="slider"` on the Thumb, so the accessible name has to
  // sit there too. We forward consumer-provided aria attributes from Root to
  // Thumb (and strip them from Root) so axe's aria-input-field-name rule
  // passes and consumers don't have to know the inner-element trick.
  const {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rootProps
  } = props as React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    "aria-label"?: string
    "aria-labelledby"?: string
  }

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-[var(--slider-root-padding-y,0px)]",
        styles.root,
        className,
      )}
      style={{ ...inline, ...props.style }}
      {...rootProps}
    >
      <SliderPrimitive.Track className="relative h-[var(--slider-track-height,0.5rem)] w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-[var(--slider-range-bg,var(--primary))]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          "block h-[var(--slider-thumb-size,1.25rem)] w-[var(--slider-thumb-size,1.25rem)] rounded-full border-2 border-primary bg-background",
          "ring-offset-background transition-all",
          "hover:scale-110 hover:shadow-md hover:shadow-primary/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          styles.thumb,
        )}
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
