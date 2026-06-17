"use client"
export const dynamic = "force-dynamic"

import { Suspense, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useT } from "@/shared/config"
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"
import { AuthBackground, AuthBrandHeader, AuthBrandPanel, AuthCard } from "@/app/auth/_components/AuthPrimitives"
import { PasswordField } from "@/app/auth/_components/PasswordField"
import { Button } from "@/ui/design-system/primitives/button"
import { Alert, AlertDescription } from "@/ui/design-system/primitives/alert"
import { accountService } from "@/infra/auth/account.service"
import { IS_MOCK } from "@/infra/api/mock"

// ABP enforces the real policy server-side; this is just a friendly client floor.
const MIN_PASSWORD_LENGTH = IS_MOCK ? 4 : 6

function Shell({ children }: { children: React.ReactNode }) {
  const t = useT("auth")
  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      <AuthBrandPanel t={t} />
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 sm:p-10 lg:min-h-0">
        <AuthBackground />
        <div className="relative z-10 w-full max-w-[400px]">
          <AuthBrandHeader t={t} className="lg:hidden" />
          <AuthCard>
            <div className="px-8 pb-10 pt-8">{children}</div>
          </AuthCard>
        </div>
      </div>
    </div>
  )
}

interface PasswordFieldsProps {
  t: (key: string) => string
  password: string
  confirm: string
  show: boolean
  isLoading: boolean
  onPassword: (v: string) => void
  onConfirm: (v: string) => void
  onToggle: () => void
}

function PasswordFields({ t, password, confirm, show, isLoading, onPassword, onConfirm, onToggle }: PasswordFieldsProps) {
  return (
    <div className="space-y-5">
      <PasswordField
        id="new-password"
        label={t("reset.new_password")}
        placeholder={t("reset.new_password")}
        value={password}
        onChange={onPassword}
        showPassword={show}
        onToggle={onToggle}
        disabled={isLoading}
        autoComplete="new-password"
        showLabel={t("show_password")}
        hideLabel={t("hide_password")}
      />
      <PasswordField
        id="confirm-password"
        label={t("reset.confirm_password")}
        placeholder={t("reset.confirm_password")}
        value={confirm}
        onChange={onConfirm}
        showPassword={show}
        onToggle={onToggle}
        disabled={isLoading}
        autoComplete="new-password"
        showLabel={t("show_password")}
        hideLabel={t("hide_password")}
      />
    </div>
  )
}

function BackToLogin({ label }: { label: string }) {
  return (
    <Button asChild variant="outline" className="mt-2 w-full">
      <Link href="/auth/login">
        <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
        {label}
      </Link>
    </Button>
  )
}

function ResetPasswordContent() {
  const t = useT("auth")
  const router = useRouter()
  const params = useSearchParams()
  const userId = params.get("userId") ?? ""
  const resetToken = params.get("resetToken") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  // ABP's email link carries both — without them this page can't do anything.
  if (!userId || !resetToken) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-7" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("reset.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("reset.invalid_link")}</p>
          <BackToLogin label={t("reset.go_to_login")} />
        </div>
      </Shell>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t("password_min_length"))
    if (password !== confirm) return setError(t("reset.mismatch"))

    setIsLoading(true)
    try {
      await accountService.resetPassword({ userId, resetToken, password })
      setDone(true)
    } catch {
      setError(t("reset.failed"))
    } finally {
      setIsLoading(false)
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("reset.success_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("reset.success_body")}</p>
          <Button className="mt-2 w-full" onClick={() => router.push("/auth/login")}>
            {t("reset.go_to_login")}
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("reset.title")}</h2>
        <p className="mt-2 text-base text-muted-foreground">{t("reset.subtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {error && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ms-2 font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <PasswordFields
          t={t}
          password={password}
          confirm={confirm}
          show={show}
          isLoading={isLoading}
          onPassword={setPassword}
          onConfirm={setConfirm}
          onToggle={() => setShow(v => !v)}
        />

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="me-2 h-5 w-5 animate-spin" />
              {t("reset.resetting")}
            </>
          ) : (
            t("reset.submit")
          )}
        </Button>
      </form>
    </Shell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
