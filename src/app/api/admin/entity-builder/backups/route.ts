/**
 * GET  /api/admin/entity-builder/backups       — list snapshots (newest first)
 * POST /api/admin/entity-builder/backups/{id}  — restore one (in [id]/route.ts)
 */

import { NextResponse } from "next/server"
import { logger } from "@/shared/logger"
import { listSnapshots } from "@/features/admin-tools/entity-builder/server/backup"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_ENTITY_BUILDER

export async function GET(): Promise<NextResponse> {
  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  try {
    const snapshots = await listSnapshots()
    return NextResponse.json({ snapshots })
  } catch (err) {
    logger.error("[entity-builder] list snapshots failed:", err)
    return NextResponse.json({ error: "Failed to list snapshots" }, { status: 500 })
  }
}
