"use client"

/**
 * Button primitive — the canonical action element.
 *
 * Design tone: enterprise / official. The previous iteration shipped a
 * lot of decorative motion (translate on hover, scale-down on active,
 * ripple effects, animated gradient backgrounds) — all of it competing
 * with the user's actual task at every click. This version trims:
 *
 *   - No hover:-translate-y: the slight rise read as "this control is
 *     about to move", which is wrong for action buttons that anchor a
 *     row or a card edge.
 *   - No ripple effect: the ripple was a Material-Design borrowed
 *     pattern at odds with the rest of the app's design language and
 *     forced React state + DOM allocations on every click for visual
 *     noise. Focus + active states already communicate "I pressed it".
 *   - active:scale-[0.98] retained (very subtle): the tactile feedback
 *     is helpful and only fires on actual press, not hover.
 *   - duration-150 across the board: snappier feel. The previous
 *     duration-300 made every state change drag.
 *   - rounded-md (size sm), rounded-lg (size default), rounded-lg (size
 *     lg): tighter than the previous rounded-lg → rounded-2xl ramp,
 *     which read as "marketing pill" at the lg size.
 *
 * NO hardcoded colors — every variant goes through a design token
 * (primary/secondary/destructive/success/warning/info/premium). The
 * ThemeCustomizer continues to wire its overrides through `resolveStyles`
 * and `resolveInlineStyles`, so admin re-skins apply on top.
 *
 * @strict @enterprise-grade
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] border",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground border-transparent shadow-sm hover:bg-primary/90",
        feature:
          "bg-gradient-to-br from-accent to-primary text-primary-foreground border-transparent shadow-sm hover:opacity-95",
        secondary: "bg-secondary text-secondary-foreground border-transparent shadow-sm hover:bg-secondary/85",
        danger: "bg-destructive text-destructive-foreground border-transparent shadow-sm hover:bg-destructive/90",
        ghost: "bg-transparent border-transparent text-foreground hover:bg-accent/10 hover:text-foreground",
        outline:
          "border-border bg-background text-foreground shadow-sm hover:bg-accent/10 hover:border-border/80 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline border-transparent shadow-none p-0 h-auto",
        success: "bg-success text-success-foreground border-transparent shadow-sm hover:bg-success/90",
        warning: "bg-warning text-warning-foreground border-transparent shadow-sm hover:bg-warning/90",
        info: "bg-info text-info-foreground border-transparent shadow-sm hover:bg-info/90",
        default: "bg-primary text-primary-foreground border-transparent shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground border-transparent shadow-sm hover:bg-destructive/90",
        premium: "bg-premium text-premium-foreground border-transparent shadow-sm hover:bg-premium/90",
      },
      // Radius reads `--button-root-radius` (the ThemeCustomizer's Button →
      // Radius control) with each size's designed value as the fallback, so
      // there is zero change at default and the customizer overrides all
      // sizes when set. `pill` keeps rounded-full (a deliberate shape).
      size: {
        sm: "h-8 px-3 text-xs rounded-[var(--button-root-radius,0.375rem)]",
        default: "h-10 px-4 py-2 text-sm rounded-[var(--button-root-radius,0.5rem)]",
        lg: "h-11 px-6 text-sm rounded-[var(--button-root-radius,0.5rem)]",
        icon: "h-10 w-10 p-0 rounded-[var(--button-root-radius,0.5rem)]",
        iconSm: "h-8 w-8 p-0 rounded-[var(--button-root-radius,0.375rem)]",
        iconLg: "h-11 w-11 p-0 rounded-[var(--button-root-radius,0.5rem)]",
        pill: "h-10 px-5 rounded-full",
      },
      shine: {
        // Kept opt-in for celebratory CTAs (e.g. the runtime-builder
        // "Generate" button) — apparent on the call-site, not implicit.
        true: "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent overflow-hidden",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      shine: false,
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shine, asChild = false, loading, children, disabled, onClick, ...props }, ref) => {
    const { settings } = useTheme()
    const componentId = "button"

    const themeStyles = resolveStyles(
      componentId,
      { variant: variant || undefined, size: size || undefined },
      settings?.components?.[componentId]?.elements,
    )
    const inlineStyles = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

    const mergedClassName = cn(buttonVariants({ variant, size, shine }), themeStyles.root, className)
    const mergedStyle = { ...inlineStyles, ...props.style }

    // asChild: Slot calls React.Children.only on its child, so we must emit
    // exactly one element. Loader is dropped in this branch — the consumer
    // owns the inner content. onClick is still forwarded.
    if (asChild) {
      return (
        <Slot className={mergedClassName} style={mergedStyle} ref={ref} {...props} onClick={onClick}>
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={mergedClassName}
        style={mergedStyle}
        ref={ref}
        disabled={disabled || loading}
        {...props}
        onClick={loading ? undefined : onClick}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        <span className={cn("inline-flex items-center gap-2", themeStyles.text, loading && "opacity-0")}>
          {children}
        </span>
      </button>
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
