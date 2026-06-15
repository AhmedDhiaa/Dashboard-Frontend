/**
 * Dynamic Permission System
 *
 * Provides a fully dynamic, API-driven permission system.
 * Permissions are sourced from the ABP application-configuration cache (useAppConfig)
 * with a fallback to the session-frozen grantedPermissions.
 * The cache refreshes every 5 min and on window focus, so permissions stay fresh
 * without requiring a re-login.
 *
 * Performance optimizations:
 * - Entity permission results are memoized in a per-render Map keyed by permissionKey
 *   to avoid recomputing the same 4-lookup result on every call.
 * - grantedPermissions is a Set for O(1) lookups.
 * - All callbacks have stable references that only update when their actual inputs change.
 *
 * @strict @enterprise-grade
 */

"use client"

import React, { createContext, useContext, useMemo, useCallback, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAppConfig } from "@/infra/auth/hooks/useAppConfig"
import { socket } from "@/infra/socket/socket"
import { logger } from "@/shared/logger"
import type { ExtendedSession, ExtendedUser } from "@/shared/types"

/**
 * SignalR event the backend emits when a user's permissions change. The
 * socket layer normalizes event names to lowercase, so this string is what
 * actually goes on the wire and what the backend Hub method should match.
 */
const PERMISSIONS_UPDATED_EVENT = "permissions-updated"

// ============================================================================
// TYPES
// ============================================================================

export interface EntityPermissions {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface FieldPermission {
  field: string
  canView: boolean
  canEdit: boolean
}

export interface PermissionContextValue {
  /** All granted permissions from API (fresh from cache) */
  grantedPermissions: Set<string>
  /** Check if a specific permission is granted */
  isGranted: (permission: string) => boolean
  /** Check multiple permissions at once (returns true if ANY is granted) */
  hasAnyPermission: (permissions: string[]) => boolean
  /** Check multiple permissions at once (returns true if ALL are granted) */
  hasAllPermissions: (permissions: string[]) => boolean
  /** Get CRUD permissions for an entity based on its permission key */
  getEntityPermissions: (permissionKey: string | undefined) => EntityPermissions
  /** Get field-level permissions for an entity */
  getFieldPermissions: (permissionKey: string, fields: string[]) => FieldPermission[]
  /** Check if user is admin (bypasses all permission checks) */
  isAdmin: boolean
  /** Loading state */
  isLoading: boolean
  /** ABP app settings from /api/abp/application-configuration */
  settings: Record<string, string>
  /** ABP feature flags */
  features: Record<string, string>
  /** Force-refresh permissions from API */
  refreshPermissions: () => Promise<void>
}

// ============================================================================
// CONTEXT
// ============================================================================

const PermissionContext = createContext<PermissionContextValue | null>(null)

// ============================================================================
// HELPERS
// ============================================================================

/** Derive EntityPermissions for a single key against a Set */
function buildEntityPermissions(
  permissionKey: string,
  grantedPermissions: Set<string>,
  isAdmin: boolean,
): EntityPermissions {
  if (isAdmin || !permissionKey) return { canView: true, canCreate: true, canUpdate: true, canDelete: true }
  return {
    canView: grantedPermissions.has(permissionKey),
    canCreate: grantedPermissions.has(`${permissionKey}.Create`),
    canUpdate: grantedPermissions.has(`${permissionKey}.Update`),
    canDelete: grantedPermissions.has(`${permissionKey}.Delete`),
  }
}

/** Check if user has admin role */
function checkIsAdmin(user?: ExtendedUser): boolean {
  if (!user) return false
  const roles = [...(user.roles || []), ...(user.roleNames || [])]
  return roles.some(r => r.toLowerCase() === "admin")
}

/** Build field level permissions for an entity */
function buildFieldPermissions(
  permissionKey: string,
  fields: string[],
  isAdmin: boolean,
  grantedPermissions: Set<string>,
): FieldPermission[] {
  if (isAdmin) {
    return fields.map(field => ({ field, canView: true, canEdit: true }))
  }

  return fields.map(field => {
    const viewPermission = `${permissionKey}.Entity.${field}`
    const editPermission = `${permissionKey}.Entity.${field}.Update`

    return {
      field,
      canView: grantedPermissions.has(viewPermission) || grantedPermissions.has(permissionKey),
      canEdit: grantedPermissions.has(editPermission) || grantedPermissions.has(`${permissionKey}.Update`),
    }
  })
}

// ============================================================================
// PROVIDER
// ============================================================================

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status, update: updateSession } = useSession()
  const user = (session as ExtendedSession | null)?.user
  const { permissions, settings, features, isLoading: isConfigLoading, refreshConfig } = useAppConfig()

  const isLoading = status === "loading" || isConfigLoading
  const grantedPermissions = useMemo(() => new Set(permissions), [permissions])
  const isAdmin = useMemo(() => checkIsAdmin(user), [user])

  // ── Push-driven invalidation ───────────────────────────────────────────────
  // When the backend grants/revokes a permission, it pushes a SignalR event.
  // We invalidate all three caches together:
  //   1. `useAppConfig._sharedConfig` — `refreshConfig()` calls
  //      `invalidateAppConfigCache()` then re-fetches; the resulting state
  //      change cascades into PermissionContext via the existing notifier.
  //   2. The Set + entityPermissions map in this provider — the existing
  //      `useEffect([grantedPermissions, isAdmin])` clears them when the new
  //      permissions array arrives from the cache refresh.
  //   3. The NextAuth session JWT (which carries `roles` / `roleNames` for
  //      the admin-bypass check) — `updateSession()` re-runs the jwt callback
  //      so role changes propagate without a re-login.
  //
  // The listener registers regardless of socket connection state — the
  // SignalR adapter buffers handlers until a connection is up, so a permission
  // change that arrives mid-reconnect still fires once the socket recovers.
  useEffect(() => {
    if (status !== "authenticated") return

    const subscription = socket.on(PERMISSIONS_UPDATED_EVENT, () => {
      logger.info("[PermissionContext] Received permissions-updated event — invalidating caches")
      void Promise.all([refreshConfig(), updateSession()]).catch(err => {
        logger.error("[PermissionContext] Failed to invalidate permission caches", err)
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [status, refreshConfig, updateSession])

  const isGranted = useCallback(
    (permission: string) => isAdmin || grantedPermissions.has(permission),
    [grantedPermissions, isAdmin],
  )

  const hasAnyPermission = useCallback(
    (permissions: string[]) => isAdmin || permissions.some(p => grantedPermissions.has(p)),
    [grantedPermissions, isAdmin],
  )

  const hasAllPermissions = useCallback(
    (permissions: string[]) => isAdmin || permissions.every(p => grantedPermissions.has(p)),
    [grantedPermissions, isAdmin],
  )

  const entityPermissionsCacheRef = useRef<Map<string, EntityPermissions>>(new Map())
  // Reset cache when dependencies change
  useEffect(() => {
    entityPermissionsCacheRef.current.clear()
  }, [grantedPermissions, isAdmin])

  const getEntityPermissions = useCallback(
    (permissionKey: string | undefined): EntityPermissions => {
      if (isAdmin || !permissionKey) return buildEntityPermissions("", grantedPermissions, true)
      const cached = entityPermissionsCacheRef.current.get(permissionKey)
      if (cached) return cached
      const result = buildEntityPermissions(permissionKey, grantedPermissions, isAdmin)
      entityPermissionsCacheRef.current.set(permissionKey, result)
      return result
    },
    [grantedPermissions, isAdmin],
  )

  const getFieldPermissions = useCallback(
    (permissionKey: string, fields: string[]) =>
      buildFieldPermissions(permissionKey, fields, isAdmin, grantedPermissions),
    [grantedPermissions, isAdmin],
  )

  const value = useMemo<PermissionContextValue>(
    () => ({
      grantedPermissions,
      isGranted,
      hasAnyPermission,
      hasAllPermissions,
      getEntityPermissions,
      getFieldPermissions,
      isAdmin,
      isLoading,
      settings,
      features,
      refreshPermissions: refreshConfig,
    }),
    [
      grantedPermissions,
      isGranted,
      hasAnyPermission,
      hasAllPermissions,
      getEntityPermissions,
      getFieldPermissions,
      isAdmin,
      isLoading,
      settings,
      features,
      refreshConfig,
    ],
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Use the permission context
 * Must be used within PermissionProvider
 */
export function usePermissionContext(): PermissionContextValue {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error("usePermissionContext must be used within PermissionProvider")
  }
  return context
}

/**
 * Hook to check entity CRUD permissions
 * Optimized: only recomputes when permissionKey or grantedPermissions change
 */
export function useEntityPermissions(permissionKey: string | undefined): EntityPermissions {
  const { getEntityPermissions } = usePermissionContext()

  return useMemo(() => {
    return getEntityPermissions(permissionKey)
  }, [permissionKey, getEntityPermissions])
}

/**
 * Hook to filter columns by permission
 * Returns only the columns the user is allowed to see
 */
export function useColumnPermissions<T extends { requiredPermission?: string }>(
  columns: T[],
  _entityPermissionKey?: string,
): T[] {
  const { isGranted, isAdmin } = usePermissionContext()

  return useMemo(() => {
    if (isAdmin) return columns

    return columns.filter(col => {
      // If column has explicit requiredPermission, check it
      if (col.requiredPermission) {
        return isGranted(col.requiredPermission)
      }
      // Otherwise, allow column (it has no permission requirement)
      return true
    })
  }, [columns, isGranted, isAdmin])
}
