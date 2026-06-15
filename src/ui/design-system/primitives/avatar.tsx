"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

/**
 * AVATAR COMPONENT - DESIGN SYSTEM COMPLIANT
 *
 * Uses ONLY CSS variables from design tokens.
 * Proper fallback styling with background and text colors.
 *
 * @strict @enterprise-grade
 */

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "avatar"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full", styles.root, className)}
      style={{ ...inline, ...props.style }}
      {...props}
    />
  )
})
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "avatar"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full",
        "bg-muted text-muted-foreground font-medium",
        styles.fallback,
        className,
      )}
      {...props}
    />
  )
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
