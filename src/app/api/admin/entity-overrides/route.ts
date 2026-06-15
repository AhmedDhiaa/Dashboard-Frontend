/**
 * Entity-config admin overrides.
 *
 *   GET    /api/admin/entity-overrides                     – full override map
 *   GET    /api/admin/entity-overrides?entityName=brand    – single entity (or 404)
 *   PATCH  /api/admin/entity-overrides                     – upsert override for one entity
 *   DELETE /api/admin/entity-overrides?entityName=brand    – reset entity to source
 *
 * The override file lives at `messages/_overrides/entity-overrides.json`
 * and is loaded into the registry on server boot (see `RootLayout`).
 * Mutations bump nothing client-watchable yet — admins refresh the
 * affected page after Save (the registry re-hydrates via SSR).
 */

import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import {
  readEntityOverrides,
  removeEntityOverride,
  setEntityOverride,
} from "@/features/admin-tools/entity-overrides/storage"
import { entityOverrideSchema } from "@/core/entities/overrides/schema"
import { setEntityOverrideMap } from "@/core/entities/registry"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_ENTITY_BUILDER

const ENTITY_NAME_PATTERN = /^[a-z][a-z0-9-]*$/

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function isValidEntityName(value: unknown): value is string {
  return typeof value === "string" && ENTITY_NAME_PATTERN.test(value)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Reading overrides is admin-gated too — they expose internal entity
  // wiring (permission keys, base paths) that non-admins shouldn't see.
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  try {
    const map = await readEntityOverrides()
    const entityName = request.nextUrl.searchParams.get("entityName")
    if (entityName) {
      if (!isValidEntityName(entityName)) return badRequest("'entityName' is malformed")
      const override = map[entityName]
      if (!override) return NextResponse.json({ error: "No override", entityName }, { status: 404 })
      return NextResponse.json({ entityName, override })
    }
    return NextResponse.json({ overrides: map })
  } catch (err) {
    logger.error("[entity-overrides] GET failed:", err)
    return NextResponse.json({ error: "Failed to read overrides" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Body must be JSON")
  }

  if (!body || typeof body !== "object") return badRequest("Body must be an object")
  const { entityName, override } = body as { entityName?: unknown; override?: unknown }

  if (!isValidEntityName(entityName)) return badRequest("'entityName' must be lowercase, hyphenated")

  const parsed = entityOverrideSchema.safeParse(override)
  if (!parsed.success) {
    return NextResponse.json({ error: "'override' is invalid", details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const map = await setEntityOverride(entityName, parsed.data)
    // Refresh in-process registry so subsequent SSR / API calls see the
    // new effective config without waiting for the next RootLayout pass.
    setEntityOverrideMap(map)
    return NextResponse.json({ entityName, override: parsed.data, overrides: map })
  } catch (err) {
    logger.error("[entity-overrides] PATCH failed:", err)
    return NextResponse.json({ error: "Failed to write override" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  const entityName = request.nextUrl.searchParams.get("entityName")
  if (!isValidEntityName(entityName)) return badRequest("'entityName' is required and must be lowercase, hyphenated")

  try {
    const { map, removed } = await removeEntityOverride(entityName)
    if (!removed) return NextResponse.json({ error: "No override to reset", entityName }, { status: 404 })
    setEntityOverrideMap(map)
    return NextResponse.json({ entityName, overrides: map })
  } catch (err) {
    logger.error("[entity-overrides] DELETE failed:", err)
    return NextResponse.json({ error: "Failed to reset override" }, { status: 500 })
  }
}
