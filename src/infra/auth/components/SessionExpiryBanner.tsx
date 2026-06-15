/**
 * Session Expiry Banner
 *
 * Fixes applied:
 * - [CRITICAL] Countdown now correctly resets to COUNTDOWN_SECONDS only when
 *   `visible` transitions false → true (not on false, which was causing
 *   premature/partial countdowns on repeated session errors).
 * - [FIX] Uses prevVisibleRef to detect the false → true transition.
 * - [A11Y] Added role="alert" aria-live="assertive" for screen readers.
 *
 * @module infra/auth/components/SessionExpiryBanner
 */

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, LogIn, X } from "lucide-react"
import { useT } from "@/shared/config"
import { useSecureUser } from "./SecureUserProvider"

const COUNTDOWN_SECONDS = 10

export function SessionExpiryBanner() {
  const { sessionError } = useSecureUser()
  const router = useRouter()
  const t = useT("auth")
  const [dismissed, setDismissed] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)

  const isExpired = sessionError === "RefreshAccessTokenError"
  const visible = isExpired && !dismissed

  // Track previous visible value so we can detect false → true transitions
  const prevVisibleRef = useRef(false)

  // [FIX] Reset countdown ONLY when banner first becomes visible (false → true).
  // The old code reset on !visible (i.e. when dismissed), so the next time the
  // banner appeared the countdown started from whatever value it held last.
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setCountdown(COUNTDOWN_SECONDS)
    }
    prevVisibleRef.current = visible
  }, [visible])

  // Also reset dismissed state when a new session error arrives
  useEffect(() => {
    if (isExpired) {
      setDismissed(false)
    }
  }, [isExpired])

  const handleRelogin = useCallback(() => {
    router.push("/auth/session-expired")
  }, [router])

  // Countdown timer + auto-redirect — only runs when banner is visible
  useEffect(() => {
    if (!visible) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          router.push("/auth/session-expired")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [visible, router])

  // Entry animation comes from the `animate-slide-in-down` CSS utility
  // (defined in globals.css). No exit animation — the banner unmounts
  // immediately on dismiss/redirect, which is fine for an expiry warning.
  if (!visible) return null

  return (
    <div
      className="animate-slide-in-down fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-4 px-4 py-2.5 bg-warning/90 text-warning-foreground shadow-lg text-sm font-semibold"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          Your session has expired. Redirecting in{" "}
          <span className="font-black tabular-nums" aria-label={`${countdown} seconds`}>
            {countdown}s
          </span>
          &hellip;
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleRelogin}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-foreground text-background text-xs font-bold hover:bg-foreground/90 transition-colors"
        >
          <LogIn className="w-3 h-3" aria-hidden="true" />
          {t("session.re_login")}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label={t("session.dismiss_warning")}
          className="p-1 rounded-md hover:bg-foreground/10 transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
