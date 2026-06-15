/**
 * Separator Component
 * Based on Radix UI Separator
 */

import * as React from "react"
import { cn } from "@/shared/utils"

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      // aria-orientation is only valid on role="separator" (and a few other
      // roles). Setting it alongside role="none" trips axe's
      // aria-allowed-attr rule. Decorative separators carry no semantics,
      // so the attribute is omitted in that case.
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className,
      )}
      {...props}
    />
  ),
)
Separator.displayName = "Separator"

export { Separator }
