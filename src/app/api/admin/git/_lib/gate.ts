/**
 * Shared gate posture for every `/api/admin/git/*` route.
 *
 * Three independent checks, each able to refuse the request on its own.
 * Wrapped in a helper so a future route can `if (!ok) return resp` without
 * duplicating the (env, NODE_ENV, permission) trio.
 *
 *   1. NODE_ENV !== "production"  → 404. Belt + braces: even if someone
 *                                   accidentally sets the flag below in
 *                                   prod, the surface is invisible.
 *   2. APP_ALLOW_RUNTIME_CODEGEN === "true" → 404 otherwise. Mirrors
 *                                   the materialize routes.
 *   3. ADMIN_GIT_OPERATIONS permission → 403 if missing.
 *
 * 404 (not 403) for env failures so scanners can't tell the surface
 * exists in locked builds.
 */

import { NextResponse } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

interface GatePass {
  ok: true
  actor: string | null
}

interface GateFail {
  ok: false
  response: NextResponse
}

function actorOf(session: { user?: { email?: string | null; name?: string | null } | null }): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

export async function gateRequest(): Promise<GatePass | GateFail> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, response: NextResponse.json({ error: "Not available" }, { status: 404 }) }
  }
  if (process.env[RUNTIME_GATE] !== "true") {
    return { ok: false, response: NextResponse.json({ error: "Not available" }, { status: 404 }) }
  }
  const guard = await requirePermission(PERMISSIONS.ADMIN_GIT_OPERATIONS)
  if (!guard.ok) return { ok: false, response: guard.response }
  return { ok: true, actor: actorOf(guard.session) }
}

export function badRequest(message: string, details?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 })
}
