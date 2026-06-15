/**
 * Reusable auth-page input field with leading icon, optional trailing slot,
 * inline error message, and consistent focus/hover styling.
 *
 * Used by login, register, and forgot-password pages so visual & accessibility
 * details (aria-invalid, aria-describedby, focus ring, error animation) live
 * in exactly one place.
 */

"use client"

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { cn } from "@/shared/utils"

interface AuthInputFieldProps extends Omit<ComponentPropsWithoutRef<typeof Input>, "id" | "error"> {
  id: string
  label: ReactNode
  icon: ReactNode
  trailing?: ReactNode
  errorMessage?: string | undefined
  labelTrailing?: ReactNode
}

export const AuthInputField = forwardRef<HTMLInputElement, AuthInputFieldProps>(function AuthInputField(
  { id, label, icon, trailing, errorMessage, labelTrailing, className, ...props },
  ref,
) {
  const errorId = errorMessage ? `${id}-error` : undefined

  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium ms-1 transition-colors group-focus-within:text-primary">
          {label}
        </Label>
        {labelTrailing}
      </div>
      <div className="relative focus-within:ring-2 focus-within:ring-primary/20 rounded-xl transition-all duration-300">
        <span className="absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
          {icon}
        </span>
        <Input
          ref={ref}
          id={id}
          error={!!errorMessage}
          aria-describedby={errorId}
          className={cn(
            "h-12 ps-12 bg-background/50 border-input/50 transition-all duration-300",
            "hover:bg-background/80 hover:border-primary/30",
            "focus-visible:ring-0 focus-visible:border-primary",
            trailing && "pe-12",
            className,
          )}
          {...props}
        />
        {trailing && <div className="absolute end-4 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-destructive ms-1 animate-in slide-in-from-top-1"
        >
          {errorMessage}
        </p>
      )}
    </div>
  )
})
