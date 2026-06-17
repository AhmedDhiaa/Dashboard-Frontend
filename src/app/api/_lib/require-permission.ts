/**
 * Generic admin-permission gate for API routes.
 *
 * Two-tier check:
 *   1. Cheap path — the slim JWT carries `roles[]`. Anyone with `admin` is allowed.
 *   2. Fine-grained — fetch fresh `grantedPolicies` from ABP's
 *      application-configuration endpoint and look for the requested
 *      permission key. The slim JWT intentionally omits grantedPermissions
 *      to keep the cookie under the HTTP 431 threshold; we re-fetch on
 *      demand only inside admin endpoints.
 *
 * Used by /api/i18n/* (Api.Translation.Manage) and /api/theme/*
 * (Api.Theme.Manage). Add new admin endpoints by calling this function
 * with their permission key — don't re-implement the two-tier logic.
 */

import { NextResponse } from "next/server"
import { auth } from "@/infra/auth/server"
import { config } from "@/shared/config"
import { logger } from "@/shared/logger"
import type { ExtendedSession } from "@/shared/types"

interface PermissionOk {
  ok: true
  session: ExtendedSession
}

interface PermissionFail {
  ok: false
  response: NextResponse
}

async function fetchGrantedPermissions(accessToken: string): Promise<string[]> {
  const baseUrl = (process.env.API_URL ?? config.api.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(
    /\/+$/,
    "",
  )
  if (!baseUrl) return []

  const url = `${baseUrl}/api/abp/application-configuration?IncludeLocalizationResources=false`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5_000)
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) return []
    const data = (await res.json()) as { auth?: { grantedPolicies?: Record<string, boolean> } }
    const granted = data.auth?.grantedPolicies ?? {}
    return Object.keys(granted).filter(k => granted[k])
  } catch (err) {
    logger.warn("[require-permission] grantedPolicies fetch failed:", err)
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Authentication-only gate: passes for any signed-in user, with no permission
 * check. Use for endpoints whose payload is needed by the whole authenticated
 * app but must not reach anonymous callers — e.g. the runtime *schema*
 * (entities/pages/dashboards): every user needs it to render runtime UIs, but
 * served to the public it leaks entity structure and permission keys. (Record
 * *data* stays permission-gated — see `requireRuntimeReader`.)
 */
export async function requireAuth(): Promise<PermissionOk | PermissionFail> {
  const session = (await auth()) as ExtendedSession | null

  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { ok: true, session }
}

export async function requirePermission(permission: string): Promise<PermissionOk | PermissionFail> {
  const session = (await auth()) as ExtendedSession | null

  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const roles = session.user.roles ?? []
  if (roles.includes("admin")) return { ok: true, session }

  if (session.accessToken) {
    const perms = await fetchGrantedPermissions(session.accessToken)
    if (perms.includes(permission)) return { ok: true, session }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Forbidden", required: permission }, { status: 403 }),
  }
}

/**
 * Like {@link requirePermission} but passes if the caller holds ANY of the
 * supplied permission keys. Useful where two distinct grants both legitimately
 * confer access — e.g. runtime record reads, which both the schema *manager*
 * and a data *writer* should be able to perform. The granted-policies fetch
 * runs at most once.
 */
export async function requireAnyPermission(permissions: string[]): Promise<PermissionOk | PermissionFail> {
  const session = (await auth()) as ExtendedSession | null

  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const roles = session.user.roles ?? []
  if (roles.includes("admin")) return { ok: true, session }

  if (session.accessToken) {
    const perms = await fetchGrantedPermissions(session.accessToken)
    if (permissions.some(p => perms.includes(p))) return { ok: true, session }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Forbidden", required: permissions }, { status: 403 }),
  }
}
