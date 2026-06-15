/**
 * Route Permission Map
 *
 * Auto-generates a mapping from URL paths to required permissions
 * by walking the navigation config. Used by AuthGuard and middleware
 * to enforce permission-based route protection.
 *
 * The map is built once at module load from `NAV_GROUPS` in navigation.ts.
 * For a given pathname, `getRequiredPermission()` returns the permission
 * string the user needs, or `undefined` if the route is public / unprotected.
 *
 * @module shared/config/route-permissions
 */

import { NAV_GROUPS, type NavItem } from "./navigation"

// ─── Build the map ───────────────────────────────────────────────────────────

type RoutePermissionMap = Map<string, string>

function normalizeHref(href: string): string {
  // Strip query params for matching (e.g. "/items?category=fuel" → "/items")
  const qIndex = href.indexOf("?")
  return qIndex >= 0 ? href.substring(0, qIndex) : href
}

function collectItems(items: readonly NavItem[], map: RoutePermissionMap): void {
  for (const item of items) {
    if (item.href && item.requiredPermission) {
      const normalized = normalizeHref(item.href)
      // First match wins (more specific sub-items are added first via recursion)
      if (!map.has(normalized)) {
        map.set(normalized, item.requiredPermission)
      }
    }
    if (item.subItems) {
      collectItems(item.subItems, map)
    }
  }
}

function buildRoutePermissionMap(): RoutePermissionMap {
  const map: RoutePermissionMap = new Map()

  for (const group of NAV_GROUPS) {
    // Process sub-items first (more specific routes)
    for (const item of group.items) {
      if (item.subItems) {
        collectItems(item.subItems, map)
      }
    }
    // Then top-level items
    collectItems(group.items as NavItem[], map)
  }

  return map
}

const ROUTE_PERMISSION_MAP = buildRoutePermissionMap()

// ─── Public API ──────────────────────────────────────────────────────────────

// Routes that are always accessible (no permission check)
const UNPROTECTED_ROUTES = [
  "/",
  "/dashboard",
  "/dashboard/kpis",
  "/dashboard/alerts",
  "/settings",
  "/settings/profile",
  "/settings/security",
  "/settings/language",
  "/settings/theme",
] as const

function isUnprotectedRoute(pathname: string): boolean {
  return UNPROTECTED_ROUTES.some(r => pathname === r)
}

/**
 * Get the required permission for a given pathname.
 *
 * Matching strategy (most-specific first):
 * 1. Unprotected routes (dashboard, settings) → always allowed
 * 2. Exact match  (e.g. "/orders/create")
 * 3. Parent match (e.g. "/orders/123/edit" → checks "/orders")
 *
 * @returns The permission string or `undefined` if no protection is defined.
 */
export function getRequiredPermission(pathname: string): string | undefined {
  // Strip locale prefix if present (e.g. "/en/orders" → "/orders")
  const stripped = pathname.replace(/^\/(en|ar)\//, "/")

  // Dashboard, settings, and other unprotected pages → always allowed
  if (isUnprotectedRoute(stripped)) return undefined

  // 1. Exact match
  if (ROUTE_PERMISSION_MAP.has(stripped)) {
    return ROUTE_PERMISSION_MAP.get(stripped)
  }

  // 2. Walk up the path tree for parent matches
  const segments = stripped.split("/").filter(Boolean)
  for (let i = segments.length - 1; i >= 1; i--) {
    const parent = "/" + segments.slice(0, i).join("/")
    if (ROUTE_PERMISSION_MAP.has(parent)) {
      return ROUTE_PERMISSION_MAP.get(parent)
    }
  }

  return undefined
}
