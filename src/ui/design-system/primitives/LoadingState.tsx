/**
 * LOADING STATE COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * NO hardcoded dark mode classes.
 * Reusable loading spinner with consistent styling.
 *
 * @strict @enterprise-grade
 */

import { Loader2 } from "lucide-react"
import { cn } from "@/shared/utils"

export interface LoadingStateProps {
  size?: "sm" | "md" | "lg"
  message?: string
  className?: string
  fullScreen?: boolean
}

export function LoadingState({ size = "md", message, className, fullScreen = false }: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        {content}
      </div>
    )
  }

  return content
}
