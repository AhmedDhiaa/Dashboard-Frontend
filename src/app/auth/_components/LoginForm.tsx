/**
 * Login form sub-component. Pure presentation — submission and effects live in
 * the page, the form just emits events.
 */

"use client"

import type React from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Alert, AlertDescription } from "@/ui/design-system/primitives/alert"
import { Loader2, AlertCircle, User } from "lucide-react"
import { cn } from "@/shared/utils"
import { AuthInputField } from "./AuthInputField"
import { PasswordField } from "./PasswordField"

interface LoginFormProps {
  t: (key: string) => string
  username: string
  password: string
  showPassword: boolean
  isLoading: boolean
  error: string
  fieldErrors: { username?: string; password?: string }
  onUsernameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onSubmit: (e: React.FormEvent) => void
}

function LoginHeader({ t }: { t: (key: string) => string }) {
  // Mobile branding is handled by <AuthBrandHeader> above the card, so this
  // header is just the title block — no duplicate logo.
  return (
    <div className="text-center mb-8">
      <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("login.title")}</h2>
      <p className="text-muted-foreground text-base mt-2">{t("login.subtitle")}</p>
    </div>
  )
}

export function LoginForm({
  t,
  username,
  password,
  showPassword,
  isLoading,
  error,
  fieldErrors,
  onUsernameChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
}: LoginFormProps) {
  return (
    <div className="px-8 pb-10 pt-8">
      <LoginHeader t={t} />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {error && (
          <Alert
            variant="destructive"
            className="animate-in fade-in zoom-in-95 duration-300 border-destructive/50 bg-destructive/10"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ms-2 font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-5">
          <AuthInputField
            id="username"
            type="text"
            autoComplete="username"
            label={t("login.username")}
            icon={<User className="h-5 w-5" />}
            placeholder={t("login.placeholders.username")}
            value={username}
            disabled={isLoading}
            errorMessage={fieldErrors.username}
            onChange={e => onUsernameChange(e.target.value)}
          />

          <PasswordField
            id="password"
            label={t("login.password")}
            placeholder={t("login.placeholders.password")}
            value={password}
            onChange={onPasswordChange}
            showPassword={showPassword}
            onToggle={onTogglePassword}
            disabled={isLoading}
            errorMessage={fieldErrors.password}
            autoComplete="current-password"
            showLabel={t("show_password")}
            hideLabel={t("hide_password")}
          />
        </div>

        <Button
          type="submit"
          className={cn(
            "w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 transition-all duration-300",
            "hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0",
            "bg-linear-to-r from-primary to-primary/80 hover:to-primary",
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("login.signing_in")}
            </>
          ) : (
            t("login.submit")
          )}
        </Button>
      </form>
    </div>
  )
}
