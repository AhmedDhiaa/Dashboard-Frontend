/**
 * Password input with show/hide toggle. Built on top of [AuthInputField].
 *
 * Used by login, register, and forgot-password flows.
 */

"use client"

import type { ReactNode } from "react"
import { Eye, EyeOff, Lock } from "lucide-react"
import { AuthInputField } from "./AuthInputField"

interface PasswordFieldProps {
  id: string
  label: ReactNode
  labelTrailing?: ReactNode
  placeholder?: string
  value: string
  onChange: (value: string) => void
  showPassword: boolean
  onToggle: () => void
  disabled?: boolean
  errorMessage?: string | undefined
  autoComplete?: "current-password" | "new-password"
  showLabel: string
  hideLabel: string
}

export function PasswordField({
  id,
  label,
  labelTrailing,
  placeholder,
  value,
  onChange,
  showPassword,
  onToggle,
  disabled,
  errorMessage,
  autoComplete = "current-password",
  showLabel,
  hideLabel,
}: PasswordFieldProps) {
  return (
    <AuthInputField
      id={id}
      type={showPassword ? "text" : "password"}
      autoComplete={autoComplete}
      label={label}
      labelTrailing={labelTrailing}
      icon={<Lock className="h-5 w-5" />}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      errorMessage={errorMessage}
      onChange={e => onChange(e.target.value)}
      trailing={
        <button
          type="button"
          onClick={onToggle}
          aria-label={showPassword ? hideLabel : showLabel}
          className="text-muted-foreground hover:text-primary transition-colors"
          disabled={disabled}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  )
}
