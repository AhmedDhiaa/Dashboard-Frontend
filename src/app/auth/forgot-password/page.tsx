"use client"
export const dynamic = "force-dynamic"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useT } from "@/shared/config"
import { Loader2, Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"
import { AuthBackground, AuthBrandHeader, AuthBrandPanel, AuthCard } from "@/app/auth/_components/AuthPrimitives"
import { AuthInputField } from "@/app/auth/_components/AuthInputField"
import { Button } from "@/ui/design-system/primitives/button"
import { Alert, AlertDescription } from "@/ui/design-system/primitives/alert"
import { accountService } from "@/infra/auth/account.service"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
  const t = useT("auth")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    const value = email.trim()
    if (!value) return setError(t("forgot.email_required"))
    if (!EMAIL_RE.test(value)) return setError(t("forgot.email_invalid"))

    setIsLoading(true)
    try {
      await accountService.sendPasswordResetCode(value)
      setSent(true)
    } catch {
      setError(t("forgot.failed"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      <AuthBrandPanel t={t} />
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 sm:p-10 lg:min-h-0">
        <AuthBackground />
        <div className="relative z-10 w-full max-w-[400px]">
          <AuthBrandHeader t={t} className="lg:hidden" />
          <AuthCard>
            <div className="px-8 pb-10 pt-8">
              {sent ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success">
                    <CheckCircle2 className="size-7" />
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("forgot.sent_title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("forgot.sent_body")}</p>
                  <Button asChild variant="outline" className="mt-2 w-full">
                    <Link href="/auth/login">
                      <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
                      {t("forgot.back_to_login")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("forgot.title")}</h2>
                    <p className="mt-2 text-base text-muted-foreground">{t("forgot.subtitle")}</p>
                  </div>

                  <form onSubmit={onSubmit} className="space-y-6" noValidate>
                    {error && (
                      <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="ms-2 font-medium">{error}</AlertDescription>
                      </Alert>
                    )}

                    <AuthInputField
                      id="email"
                      type="email"
                      autoComplete="email"
                      label={t("forgot.email")}
                      icon={<Mail className="h-5 w-5" />}
                      placeholder={t("forgot.email_placeholder")}
                      value={email}
                      disabled={isLoading}
                      onChange={e => setEmail(e.target.value)}
                    />

                    <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="me-2 h-5 w-5 animate-spin" />
                          {t("forgot.sending")}
                        </>
                      ) : (
                        t("forgot.submit")
                      )}
                    </Button>

                    <div className="text-center">
                      <Link
                        href="/auth/login"
                        className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowLeft className="me-1.5 size-4 rtl:rotate-180" />
                        {t("forgot.back_to_login")}
                      </Link>
                    </div>
                  </form>
                </>
              )}
            </div>
          </AuthCard>
        </div>
      </div>
    </div>
  )
}
