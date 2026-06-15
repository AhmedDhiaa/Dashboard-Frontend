"use client"
// Uses React.useMemo() — must be a Client Component. Removing this
// directive crashes Server Component callers with a server-context
// hook error.

/**
 * Icon Wrapper Component
 *
 * Provides consistent icon styling with containers and effects
 */

import * as React from "react"
import { cn } from "@/shared/utils"
import { type LucideIcon } from "lucide-react"

interface IconWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon | React.ReactNode
  size?: "sm" | "md" | "lg"
  variant?: "primary" | "accent" | "muted" | "success" | "warning" | "danger"
  animate?: "spin" | "pulse" | "none"
  containerless?: boolean
}

const IconWrapper = React.forwardRef<HTMLDivElement, IconWrapperProps>(
  ({ icon, size = "md", variant = "primary", animate = "none", containerless = false, className, ...props }, ref) => {
    const Icon = React.useMemo(() => {
      if (!icon) return null

      // Use unknown as intermediate to bypass overly restrictive overlapping checks
      const item = icon as unknown

      // If it's a function (Functional Component/Class) or a specialized component object
      if (typeof item === "function" || (typeof item === "object" && item !== null && "$$typeof" in item)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return item as React.ComponentType<any>
      }

      return null
    }, [icon])

    const sizeClasses = {
      sm: "icon-container-sm",
      md: "icon-container-md",
      lg: "icon-container-lg",
    }

    const variantClasses = {
      primary: "icon-container-primary",
      accent: "icon-container-accent",
      muted: "icon-container-muted",
      success: "bg-gradient-to-br from-success/15 to-success/5 text-success hover:from-success/25 hover:to-success/10",
      warning: "bg-gradient-to-br from-warning/15 to-warning/5 text-warning hover:from-warning/25 hover:to-warning/10",
      danger:
        "bg-gradient-to-br from-destructive/15 to-destructive/5 text-destructive hover:from-destructive/25 hover:to-destructive/10",
    }

    const animationClasses = {
      spin: "icon-spin",
      pulse: "icon-pulse",
      none: "",
    }

    if (containerless) {
      return (
        <div ref={ref} className={cn("inline-flex", className)} {...props}>
          {Icon ? <Icon className={cn("size-5", animationClasses[animate])} /> : (icon as React.ReactNode)}
        </div>
      )
    }

    return (
      <div ref={ref} className={cn("icon-container", sizeClasses[size], variantClasses[variant], className)} {...props}>
        {Icon ? <Icon className={cn("size-5", animationClasses[animate])} /> : (icon as React.ReactNode)}
      </div>
    )
  },
)
IconWrapper.displayName = "IconWrapper"

export { IconWrapper }
export type { IconWrapperProps }
