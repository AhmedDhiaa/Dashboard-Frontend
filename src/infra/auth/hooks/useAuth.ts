/**
 * Authentication hook — thin wrapper around `useSession()`.
 *
 * Login goes through `signIn("credentials", …)` from next-auth/react directly
 * (see `useLoginForm`); logout goes through `signOut()`. Token refresh lives
 * exclusively in the NextAuth `jwt` callback — there is no client-side refresh
 * loop, no in-memory token cache, and no manual refresh affordance. Anything
 * that needs a fresh access token reads `useSession()` (or calls `getSession()`
 * outside React); the session response always carries a valid token because
 * the jwt callback refreshes it on the way out.
 *
 * @module infra/auth/hooks/useAuth
 */

"use client"

import { getErrorMessage } from "@/infra/api"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { fetchApplicationConfiguration, invalidateAppConfigCache } from "@/infra/auth/application-config.service"
import type { CurrentUser, ExtendedSession } from "@/shared/types"
import { logger } from "@/shared/logger"
import { useNotification } from "@/ui/application"

interface UseAuthReturn {
  user: CurrentUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  logout: () => Promise<void>
}

/** Minimal fallback user when the /application-configuration endpoint is unavailable (404). */
const FALLBACK_USER: CurrentUser = {
  id: "unknown",
  userName: "User",
  isAuthenticated: true,
  roles: [],
  tenantId: null,
  impersonatorUserId: null,
  impersonatorTenantId: null,
  impersonatorUserName: null,
  impersonatorTenantName: null,
  name: "User",
  surName: null,
  email: null,
  emailVerified: false,
  phoneNumber: null,
  phoneNumberVerified: false,
  sessionId: null,
}

export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const notifications = useNotification()

  const ext = session as ExtendedSession | null
  const isAuthenticated = status === "authenticated" && !!ext?.accessToken && !ext.error

  // Load CurrentUser from /application-configuration once authenticated. The
  // session's ExtendedUser is a slimmed-down JWT view; the app-config endpoint
  // is the richer source for tenant/feature/role context.
  const loadUser = useCallback(async () => {
    try {
      setIsLoadingUser(true)
      const config = await fetchApplicationConfiguration()
      setUser(config.currentUser)
      setError(null)
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number } }
      const httpStatus = axiosError?.response?.status

      if (httpStatus === 404) {
        logger.info("useAuth: app-config endpoint unavailable (404), using fallback user")
        setUser(FALLBACK_USER)
        setError(null)
      } else if (httpStatus === 401 || httpStatus === 403) {
        logger.warn("useAuth: app-config rejected by server")
        setUser(null)
        setError("Authentication failed")
      } else {
        logger.error("useAuth: failed to load user", err)
        setUser(null)
        setError(getErrorMessage(err))
      }
    } finally {
      setIsLoadingUser(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && !user) {
      loadUser()
    } else if (status === "unauthenticated" && user) {
      setUser(null)
    }
  }, [isAuthenticated, status, user, loadUser])

  const logout = useCallback(async () => {
    try {
      invalidateAppConfigCache()
      setUser(null)
      await signOut({ redirect: false })
      notifications.info("auth.logoutSuccess")
      router.push("/auth/login")
    } catch (err) {
      logger.error("useAuth: logout error", err)
      router.push("/auth/login")
    }
  }, [router, notifications])

  return {
    user,
    isAuthenticated,
    isLoading: status === "loading" || isLoadingUser,
    error,
    logout,
  }
}
