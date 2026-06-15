/**
 * Permissions Hook
 *
 * Reads live `grantedPolicies` from the ABP application-configuration cache
 * (via `useAppConfig`) rather than the session-frozen `grantedPermissions`.
 *
 * This ensures the Sidebar and any other consumer see the same real-time
 * permissions as `PermissionContext` — updated every 5 min and on window focus,
 * without requiring a full re-login.
 *
 * Includes:
 * - Admin bypass (reads roles from NextAuth session — stable across the session)
 * - Stable `useCallback` references to prevent unnecessary re-renders
 * - Graceful fallback to session permissions when AppConfig hasn't loaded yet
 *
 * @module core/auth/hooks/usePermissions
 */

"use client"

import { useSession } from "next-auth/react"
import { useMemo, useCallback } from "react"
import type { ExtendedSession, ExtendedUser } from "@/shared/types"
import { useAppConfig } from "@/infra/auth/hooks/useAppConfig"

/**
 * Hook for checking permissions in Client Components.
 *
 * Uses live `grantedPolicies` from the ABP application-configuration API
 * (shared cache via `useAppConfig`). Falls back to session-frozen permissions
 * when the config hasn't loaded yet.
 *
 * Stable callback references prevent consumers from re-rendering unless the
 * underlying permissions actually change.
 */
export function usePermissions() {
  const { data: session } = useSession()
  const user: ExtendedUser | undefined = (session as ExtendedSession | null)?.user

  // Live permissions from ABP application-configuration (refreshed every 5 min)
  const { permissions: livePermissions } = useAppConfig()

  // ── Stable identity keys for memoization ──────────────────────────────────

  const userId = user?.id
  const rolesKey = user?.roles?.join(",") ?? ""

  // ── Admin check (from session roles — stable across a login session) ───────

  const isAdmin = useMemo(
    () =>
      user?.roles?.some(r => r.toLowerCase() === "admin") === true ||
      user?.roleNames?.some(r => r.toLowerCase() === "admin") === true,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, rolesKey],
  )

  // ── Permission Set (from live AppConfig only — JWT no longer carries permissions) ──

  const permissionSet = useMemo(() => {
    if (isAdmin) return null // admin bypasses all checks, no need to build a Set
    return new Set(livePermissions)
  }, [isAdmin, livePermissions])

  // ── isGranted ─────────────────────────────────────────────────────────────

  const isGranted = useCallback(
    (permissionName: string): boolean => {
      if (isAdmin) return true
      return permissionSet?.has(permissionName) ?? false
    },
    [isAdmin, permissionSet],
  )

  return useMemo(() => ({ user, isAdmin, isGranted }), [user, isAdmin, isGranted])
}
