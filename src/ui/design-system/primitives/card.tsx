"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

/**
 * Card primitive — neutral container surface for the application.
 *
 * Design tone: enterprise / official. Choices and the reasoning:
 *   - rounded-xl (not rounded-3xl): pill-cards read as "marketing site". A
 *     12 px radius reads as "product surface" — the same radius as the
 *     input, button, and table primitives, so cards align visually with
 *     the controls they contain.
 *   - shadow-sm at rest, shadow-md on hover: enough elevation to separate
 *     the card from the page background, no further. shadow-2xl produced
 *     a "floating glass tile" look that fights with the table + form
 *     content underneath.
 *   - No hover:translate / hover:scale: motion on every card is noise
 *     during data review. Reserve motion for interactive controls.
 *   - Solid bg-card (no backdrop-blur on the body): the blur was a fight
 *     against legibility on data-dense list pages. Glass effects survive
 *     on sticky headers + dialogs only — where the blur disambiguates
 *     the floating layer from the scrolled body.
 *
 * The theme engine still wires every element through `resolveStyles` /
 * `resolveInlineStyles` so admin overrides via ThemeCustomizer continue
 * to work end-to-end — the classes here are the *default* presentation,
 * not the final one.
 */

import * as React from "react"
import { cn } from "@/shared/utils"
import { Button } from "./button"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "card"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--card-root-radius,0.75rem)] border border-border bg-card text-card-foreground",
        "shadow-sm transition-shadow duration-200",
        "hover:shadow-md",
        "overflow-hidden",
        styles.root,
        className,
      )}
      style={{ ...inline, ...props.style }}
      {...props}
    />
  )
})
Card.displayName = "Card"

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode
  icon?: React.ReactNode
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, actions, icon, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-between gap-4 px-6 py-4 border-b border-border bg-card", className)}
      {...props}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && (
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary [&_svg]:size-5 shrink-0">
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-1 flex-1 min-w-0">{children}</div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const { settings } = useTheme()
    const componentId = "card"
    const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)

    return (
      <h3
        ref={ref}
        className={cn(
          "[font-size:var(--card-title-font-size,1rem)] [font-weight:var(--card-title-font-weight,600)] leading-snug text-foreground",
          styles.title,
          className,
        )}
        {...props}
      />
    )
  },
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { settings } = useTheme()
    const componentId = "card"
    const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)

    return (
      <p
        ref={ref}
        className={cn(
          "[font-size:var(--card-description-font-size,0.875rem)] [opacity:var(--card-description-opacity,1)] text-muted-foreground leading-normal",
          styles.description,
          className,
        )}
        {...props}
      />
    )
  },
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-[var(--card-root-padding,1.5rem)]", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-3 px-6 py-4 border-t border-border bg-muted/30", className)}
      {...props}
    />
  ),
)
CardFooter.displayName = "CardFooter"

interface CardActionButtonProps {
  icon: React.ReactNode
  onClick?: (e?: React.BaseSyntheticEvent) => void | Promise<void>
  variant?:
    | "primary"
    | "secondary"
    | "danger"
    | "ghost"
    | "outline"
    | "feature"
    | "success"
    | "warning"
    | "info"
    | "premium"
  tooltip?: string
  disabled?: boolean
  name?: string
  className?: string
  shine?: boolean
}

const CardActionButton = React.forwardRef<HTMLButtonElement, CardActionButtonProps>(
  ({ icon, onClick, variant = "ghost", tooltip, disabled, name, className, shine, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={name ? "sm" : "icon"}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      name={name}
      shine={shine}
      className={cn("transition-colors duration-150", className)}
      {...props}
    >
      {icon}
      {name && <span className="ms-2">{name}</span>}
    </Button>
  ),
)
CardActionButton.displayName = "CardActionButton"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardActionButton }
