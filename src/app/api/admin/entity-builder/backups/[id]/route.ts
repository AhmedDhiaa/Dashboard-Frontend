/**
 * POST /api/admin/entity-builder/backups/{id}
 *
 * Restore every file captured in the snapshot back to its original path.
 * Gated by the same `Api.Admin.EntityBuilder` permission as generate; the
 * destructive nature (overwriting current source) warrants the same trust
 * level as a write.
 *
 * Re-runs `npm run init-entities` after restore so the registry reflects
 * the rolled-back set of entities.
 */

import { execSync } from "node:child_process"
import { NextResponse, type NextRequest } from "next/server"
import { logger } from "@/shared/logger"
import { restoreSnapshot } from "@/features/admin-tools/entity-builder/server/backup"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_ENTITY_BUILDER
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  // Belt + braces: restore overwrites current source, so it must never run in
  // a production build — 404 (not 409) so the surface stays invisible there,
  // matching the git-bridge and entity-converter restore gates.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 })
  }

  if (process.env[RUNTIME_GATE] !== "true") {
    return NextResponse.json(
      { error: `Restore only runs in runtime mode (set ${RUNTIME_GATE}=true).` },
      { status: 409 },
    )
  }

  const { id } = await params
  if (!/^[A-Za-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid snapshot id" }, { status: 400 })
  }

  try {
    const result = await restoreSnapshot(id)
    // Refresh the entity registry so the restored configs are picked up.
    try {
      execSync("npm run init-entities", { cwd: process.cwd(), stdio: "pipe" })
    } catch (err) {
      result.warnings.push(`init-entities: ${(err as Error).message.slice(0, 200)}`)
    }
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    logger.error("[entity-builder] restore failed:", err)
    const message = (err as Error).message
    const status = message.includes("not found") ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
