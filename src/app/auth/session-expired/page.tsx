/**
 * Session Expired Page
 *
 * Shown when the refresh token has expired or been revoked (RefreshAccessTokenError).
 * Features an auto-redirect countdown to /auth/login.
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Timer, LogIn } from "lucide-react"
import { useT } from "@/shared/config"

const REDIRECT_DELAY = 8

export default function SessionExpiredPage() {
  const router = useRouter()
  const t = useT("auth")
  const [seconds, setSeconds] = useState(REDIRECT_DELAY)

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(interval)
          router.replace("/auth/login")
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center text-center max-w-md gap-8"
      >
        {/* Animated icon */}
        <div className="relative">
          <div className="w-28 h-28 rounded-[2.5rem] bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
            <Timer className="w-14 h-14 text-primary/70" strokeWidth={1.5} />
          </div>
          {/* countdown ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112" fill="none">
            <circle cx="56" cy="56" r="52" stroke="var(--border)" strokeWidth="4" />
            <circle
              cx="56"
              cy="56"
              r="52"
              stroke="var(--primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={327}
              strokeDashoffset={327 - (327 * seconds) / REDIRECT_DELAY}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          {/* number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black text-primary tabular-nums">{seconds}</span>
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-foreground tracking-tight">{t("session.expired_title")}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your session has expired or been revoked. You will be redirected to the login page automatically in{" "}
            <span className="font-bold text-primary">
              {seconds} second{seconds !== 1 ? "s" : ""}
            </span>
            .
          </p>
        </div>

        {/* Action */}
        <button
          onClick={() => router.replace("/auth/login")}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md"
        >
          <LogIn className="w-4 h-4" />
          {t("session.login_now")}
        </button>
      </motion.div>
    </main>
  )
}
