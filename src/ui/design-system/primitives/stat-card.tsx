/**
 * Stat Card Component
 *
 * Specialized card for displaying statistics with icons
 */

import * as React from "react"
import { cn } from "@/shared/utils"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { IconWrapper } from "./icon-wrapper"
import { type LucideIcon } from "lucide-react"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  icon?: LucideIcon
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: "primary" | "accent" | "success" | "warning" | "danger"
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, icon, description, trend, variant = "primary", className, ...props }, ref) => {
    return (
      <Card ref={ref} className={cn("card-interactive", className)} {...props}>
        <CardHeader icon={icon ? <IconWrapper icon={icon} variant={variant} containerless /> : undefined}>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <div className="card-stat">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {trend && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-semibold",
                  trend.isPositive ? "text-success" : "text-destructive",
                )}
              >
                <span>{trend.isPositive ? "↑" : "↓"}</span>
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  },
)
StatCard.displayName = "StatCard"

export { StatCard }
export type { StatCardProps }
