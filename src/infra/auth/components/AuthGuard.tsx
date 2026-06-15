/**
 * Client-Side Auth Guard Component
 *
 * Architecture:
 *   - The next auth state is derived synchronously from the inputs (session
 *     status, permissions, pathname) using `useMemo`. This eliminates the
 *     setState-in-effect cascade flagged by the React lint rule.
 *   - A single effect watches the derived state for "redirecting" / "forbidden"
 *     transitions and dispatches `router.replace(...)` once.
 *   - An `isMounted` ref guards the effect so we never call `router.replace`
 *     after unmount during rapid navigation.
 *
 * @module infra/auth/components/AuthGuard
 */

"use client"

import { useEffect, useMemo, useRef, useState, memo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { isPublicPath } from "@/infra/auth/auth-constants"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { getRequiredPermission } from "@/shared/config/route-permissions"
import { logger } from "@/shared/logger"
import { getSafePath } from "@/shared/utils/url"
import { AppShellSkeleton } from "./AppShellSkeleton"

interface AuthGuardProps {
  children: React.ReactNode
}

export type AuthState = "checking" | "authorized" | "redirect-login" | "forbidden"

/** Returns true if the current route requires a permission that the user lacks. */
function isRouteBlocked(pathname: string, permissions: Set<string>, admin: boolean): boolean {
  if (admin || permissions.size === 0) return false
  const required = getRequiredPermission(pathname)
  return !!required && !permissions.has(required)
}

export interface DeriveStateInput {
  pathname: string | null
  status: "loading" | "authenticated" | "unauthenticated"
  permissions: Set<string>
  isAdmin: boolean
  permLoading: boolean
}

export function deriveAuthState({ pathname, status, permissions, isAdmin, permLoading }: DeriveStateInput): AuthState {
  if (pathname && isPublicPath(pathname)) return "authorized"

  // We can't peek at the access token from JS any more (it lives in the
  // HttpOnly NextAuth session cookie). The skeleton stays up while NextAuth
  // resolves the session — typically one round-trip on first paint.
  if (status === "loading") return "checking"

  if (status === "authenticated") {
    if (permLoading) return "authorized"
    if (pathname && isRouteBlocked(pathname, permissions, isAdmin)) return "forbidden"
    return "authorized"
  }

  return "redirect-login"
}

function AuthGuardInner({ children }: AuthGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { status } = useSession()
  const { grantedPermissions, isAdmin, isLoading: permLoading } = usePermissionContext()

  // Track hydration: SSR + first client render must produce identical output.
  // We always show the skeleton during this initial pass; after hydration the
  // session-driven authState takes over.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  const derivedState = useMemo<AuthState>(
    () =>
      deriveAuthState({
        pathname,
        status,
        permissions: grantedPermissions,
        isAdmin,
        permLoading,
      }),
    [pathname, status, grantedPermissions, isAdmin, permLoading],
  )

  const authState: AuthState = hydrated ? derivedState : "checking"

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!isMounted.current || !hydrated) return

    if (authState === "forbidden") {
      logger.warn(`AuthGuard: access denied to ${pathname}`)
      router.replace("/403")
      return
    }

    if (authState === "redirect-login") {
      const safePath = getSafePath(pathname)
      router.replace(`/auth/login?redirectTo=${encodeURIComponent(safePath)}`)
    }
  }, [authState, pathname, router, hydrated])

  if (authState === "checking") return <AppShellSkeleton />
  if (authState === "redirect-login" || authState === "forbidden") return null
  return <>{children}</>
}

export const AuthGuard = memo(AuthGuardInner)
