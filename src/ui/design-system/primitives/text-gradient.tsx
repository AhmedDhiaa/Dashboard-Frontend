/**
 * Text Gradient Component
 *
 * Beautiful gradient text effects
 */

import * as React from "react"
import { cn } from "@/shared/utils"

interface TextGradientProps {
  variant?: "primary" | "accent" | "success" | "warning"
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p"
  className?: string
  children?: React.ReactNode
}

const TextGradient = React.forwardRef<HTMLElement, TextGradientProps>(
  ({ variant = "primary", as = "span", className, children, ...props }, ref) => {
    const Component = as

    const variantClasses = {
      primary: "text-gradient-primary",
      accent: "text-gradient-accent",
      success: "bg-gradient-to-r from-success to-success/80 bg-clip-text text-transparent font-bold",
      warning: "bg-gradient-to-r from-warning to-warning/80 bg-clip-text text-transparent font-bold",
    }

    return React.createElement(
      Component,
      {
        ref,
        className: cn(variantClasses[variant], className),
        ...props,
      },
      children,
    )
  },
)
TextGradient.displayName = "TextGradient"

export { TextGradient }
export type { TextGradientProps }
