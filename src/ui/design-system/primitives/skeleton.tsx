"use client"

/**
 * SKELETON COMPONENT
 * Must be "use client" because it uses useTheme() from ThemeManager.
 */

import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { settings } = useTheme()
  const componentId = "skeleton"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/50",
        "before:absolute before:inset-0",
        "before:-translate-x-full before:animate-[shimmer_2s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-muted before:to-transparent",
        styles.root,
        className,
      )}
      style={{ ...inline, ...props.style }}
      {...props}
    />
  )
}

export { Skeleton }
