/**
 * Secure User Provider
 *
 * Provides a centralized, memoized React context for the authenticated user
 * derived from the NextAuth session. All components that need user data,
 * permissions, or role checks should consume this context instead of
 * calling useSession() directly — this prevents unnecessary re-renders
 * and ensures a single source of truth.
 *
 * @module infra/auth/components/SecureUserProvider
 */

"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import type { ExtendedSession, ExtendedUser } from "@/shared/types"

// ─── Context Shape ───────────────────────────────────────────────────────────

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "error"

// Authorization (isGranted, isAdmin, role checks) lives in PermissionContext.
// SecureUserProvider only exposes session-level state — keep them separate.
export interface SecureUserContextValue {
  /** The authenticated user object (null when loading or unauthenticated) */
  user: ExtendedUser | null
  /** NextAuth session status */
  status: "loading" | "authenticated" | "unauthenticated"
  /**
   * Resolved session status — includes "error" when RefreshAccessTokenError occurs.
   * Prefer this over combining `status` + `sessionError` manually.
   */
  sessionStatus: SessionStatus
  /** Whether the session is still being fetched */
  isLoading: boolean
  /** Whether the user is fully authenticated (status + user present) */
  isAuthenticated: boolean
  /** Access token from the session */
  accessToken: string | undefined
  /** Session-level error (e.g. RefreshAccessTokenError) */
  sessionError: string | undefined
}

const SecureUserContext = createContext<SecureUserContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function SecureUserProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const ext = session as ExtendedSession | null

  const user = ext?.user ?? null
  const accessToken = ext?.accessToken
  const sessionError = ext?.error
  const isLoading = status === "loading"
  const isAuthenticated = status === "authenticated" && !!user && !sessionError

  const sessionStatus = useMemo((): SessionStatus => {
    if (sessionError) return "error"
    if (status === "loading") return "loading"
    if (status === "authenticated") return "authenticated"
    return "unauthenticated"
  }, [status, sessionError])

  const value = useMemo<SecureUserContextValue>(
    () => ({
      user,
      status,
      sessionStatus,
      isLoading,
      isAuthenticated,
      accessToken,
      sessionError,
    }),
    [user, status, sessionStatus, isLoading, isAuthenticated, accessToken, sessionError],
  )

  return <SecureUserContext.Provider value={value}>{children}</SecureUserContext.Provider>
}

// ─── Consumer hook ───────────────────────────────────────────────────────────

/**
 * Access the authenticated user context.
 * Must be used inside `<SecureUserProvider>`.
 */
export function useSecureUser(): SecureUserContextValue {
  const ctx = useContext(SecureUserContext)
  if (!ctx) {
    throw new Error(
      "useSecureUser must be used within a <SecureUserProvider>. " +
        "Wrap your component tree with <SecureUserProvider> (typically in ClientProviders).",
    )
  }
  return ctx
}
