/**
 * Custom hook that consolidates the three side-effects historically inlined in
 * the login page:
 *
 *   1. Force-signout when the session is corrupted (token refresh error,
 *      explicit `?error=SessionError`, etc.).
 *   2. Map URL `?error=…` codes to a human-readable message.
 *   3. Auto-redirect already-authenticated visitors to the safe `redirectTo`.
 *
 * Extracted to keep [LoginPageContent] under the cyclomatic complexity ceiling
 * while preserving exact behavior.
 */

"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { useRouter, type ReadonlyURLSearchParams } from "next/navigation"
import { signOut } from "next-auth/react"
import { logger } from "@/shared/logger"
import { getSafePath } from "@/shared/utils/url"
import type { ExtendedSession } from "@/shared/types"

interface UseLoginSessionSyncArgs {
  status: "loading" | "authenticated" | "unauthenticated"
  session: ExtendedSession | null
  searchParams: ReadonlyURLSearchParams
  t: (key: string) => string
  error: string
  setError: Dispatch<SetStateAction<string>>
  isLoading: boolean
}

interface UseLoginSessionSyncResult {
  isSessionLoading: boolean
}

const URL_ERROR_TO_KEY: Record<string, string> = {
  SessionError: "session.expired",
  RefreshAccessTokenError: "session.expired",
  AccessDenied: "errors.access_denied",
}

export function useLoginSessionSync({
  status,
  session,
  searchParams,
  t,
  error,
  setError,
  isLoading,
}: UseLoginSessionSyncArgs): UseLoginSessionSyncResult {
  const router = useRouter()
  const urlError = searchParams.get("error")
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  // 1. Force-signout for corrupted sessions to break redirect loops
  useEffect(() => {
    const corrupted = (status === "authenticated" && session?.error) || urlError === "SessionError"
    if (corrupted && !isCleaningUp) {
      logger.warn("Corrupted session on Login page, forcing signout...")
      setIsCleaningUp(true)
      void signOut({ redirect: false }).then(() => logger.info("Session cleared"))
    }
  }, [status, session?.error, urlError, isCleaningUp])

  // 2. Map URL error codes to display messages
  useEffect(() => {
    if (!urlError || error || isLoading || status === "authenticated") return
    const key = URL_ERROR_TO_KEY[urlError]
    setError(key ? t(key) : t("unexpected_error"))
  }, [urlError, t, error, isLoading, status, setError])

  // 3. Redirect already-authenticated visitors. The session itself is the
  // source of truth — `accessToken` is present iff the JWT has a non-expired
  // token on the server, since the session payload comes from the jwt
  // callback which refreshes on demand.
  useEffect(() => {
    if (status !== "authenticated" || !session || session.error) return
    if (!session.accessToken) return

    const raw = searchParams.get("redirectTo") || searchParams.get("callbackUrl") || "/"
    const redirectTo = getSafePath(raw)
    if (redirectTo.includes("/auth/login")) return

    logger.info("Auto-redirecting authenticated user:", redirectTo)
    router.push(redirectTo)
    // searchParams is referentially stable per render in Next; keep deps minimal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session])

  return {
    // Show spinner only while NextAuth is still resolving and there's no URL error to surface.
    isSessionLoading: status === "loading" && !urlError,
  }
}
