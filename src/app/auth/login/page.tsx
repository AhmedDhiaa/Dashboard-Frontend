"use client"
export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useT } from "@/shared/config"
import type { ExtendedSession } from "@/shared/types"
import { Loader2 } from "lucide-react"
import { AuthBackground, AuthBrandHeader, AuthBrandPanel, AuthCard } from "@/app/auth/_components/AuthPrimitives"
import { LoginForm } from "@/app/auth/_components/LoginForm"
import { useLoginSessionSync } from "@/app/auth/_hooks/useLoginSessionSync"
import { useLoginForm } from "@/app/auth/_hooks/useLoginForm"

function SessionResolvingSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function LoginPageContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const t = useT("auth")

  const { setError, ...formProps } = useLoginForm(t)

  const { isSessionLoading } = useLoginSessionSync({
    status,
    session: session as ExtendedSession | null,
    searchParams,
    t,
    error: formProps.error,
    setError,
    isLoading: formProps.isLoading,
  })

  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-[1.15fr_1fr]">
      {/* Brand panel — desktop only */}
      <AuthBrandPanel t={t} />

      {/* Form column */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 sm:p-10 lg:min-h-0">
        <AuthBackground />
        <div className="relative z-10 w-full max-w-[400px]">
          {isSessionLoading ? (
            <div className="flex justify-center">
              <SessionResolvingSpinner label={t("loading")} />
            </div>
          ) : (
            <>
              {/* Compact brand only where the panel is hidden */}
              <AuthBrandHeader t={t} className="lg:hidden" />
              <AuthCard>
                <LoginForm t={t} {...formProps} />
              </AuthCard>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
