/**
 * GET /api/admin/widget-builder/preview?entity=<name>
 *
 * Lightweight pass-through for the wizard's live-preview mode. Pulls a
 * sample (first 25 rows) from the registered entity's REST endpoint via
 * the admin's session. The wizard renders the result through the same
 * WidgetRenderer the canvas uses, so what you see here is what your
 * users will see.
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { config } from "@/shared/config"
import { auth } from "@/infra/auth/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import type { ExtendedSession } from "@/shared/types"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_WIDGET_BUILDER
const ENTITY_RE = /^[a-z][a-z0-9-]*$/

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  const entity = request.nextUrl.searchParams.get("entity")
  if (!entity || !ENTITY_RE.test(entity)) {
    return NextResponse.json({ error: "entity is required (lowercase kebab)" }, { status: 400 })
  }

  const session = (await auth()) as ExtendedSession | null
  if (!session?.accessToken) {
    return NextResponse.json({ items: [] })
  }

  const baseUrl = (process.env.API_URL ?? config.api.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(
    /\/+$/,
    "",
  )
  if (!baseUrl) return NextResponse.json({ items: [] })

  // Convention used across the entity-builder generated code: each entity
  // is exposed under /api/app/<name>. Items inside the response are at
  // either `.items` or `.data`, depending on the legacy endpoint shape.
  const url = `${baseUrl}/api/app/${entity}?MaxResultCount=25`
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}`, Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}`, items: [] }, { status: 502 })
    }
    const payload = (await res.json()) as Record<string, unknown>
    const items = pickItems(payload)
    return NextResponse.json({ items })
  } catch (err) {
    logger.warn("[widget-builder] preview fetch failed:", err)
    return NextResponse.json({ items: [] })
  }
}

function pickItems(payload: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["items", "data", "results"]) {
    const v = payload[key]
    if (Array.isArray(v)) return v as Record<string, unknown>[]
  }
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  return []
}
