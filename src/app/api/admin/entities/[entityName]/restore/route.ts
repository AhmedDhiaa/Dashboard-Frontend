/**
 * POST /api/admin/entities/<entityName>/restore
 *
 * Inverse of the convert route (Part 1.2). Body carries the backupId
 * the admin wants to restore from; the snapshot dir is the source of
 * truth. The route is a thin wrapper around `restoreStaticEntity`
 * (`./_lib/restore.ts`); all transactional and rollback logic lives
 * in that module so a future Server Action can call it directly.
 *
 * Same gates as the convert route: NODE_ENV !== production AND
 * APP_ALLOW_RUNTIME_CODEGEN=true AND admin permission. Without
 * those, the route 404s — its existence stays invisible.
 */

import { NextResponse, type NextRequest } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { previewRestore, restoreStaticEntity } from "./_lib/restore"
import type { ExtendedSession } from "@/shared/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_ENTITY_BUILDER
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

// Mirror the convert route's URL-segment regex so refusals here surface
// at the same boundary instead of leaking into _lib's filesystem walks.
const ENTITY_NAME_PATTERN = /^[a-z][a-z0-9-]{0,40}$/

// Backup ids are emitted by `timestampId()` in backup.ts as an ISO
// string with `:` / `.` swapped for `-`. Match that shape strictly so
// path-traversal payloads (`../etc`, `foo/bar`) never reach the FS.
const BACKUP_ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/

type RouteContext = { params: Promise<{ entityName: string }> }

interface PostBody {
  backupId?: string
}

function actorOf(session: ExtendedSession): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 })
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return notFound()
  if (process.env[RUNTIME_GATE] !== "true") return notFound()

  const guard = await requirePermission(MANAGE_PERMISSION)
  if (!guard.ok) return guard.response

  const { entityName } = await context.params
  if (!ENTITY_NAME_PATTERN.test(entityName)) {
    return NextResponse.json({ error: "Invalid entityName" }, { status: 400 })
  }

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: "Body must be JSON { backupId }" }, { status: 400 })
  }
  if (typeof body.backupId !== "string" || !BACKUP_ID_PATTERN.test(body.backupId)) {
    return NextResponse.json({ error: "backupId is required and must match the timestamp shape" }, { status: 400 })
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"
  const actor = actorOf(guard.session)

  if (dryRun) {
    const preview = await previewRestore(entityName, { backupId: body.backupId, dryRun: true, actor })
    if (!preview.ok) {
      return NextResponse.json({ error: preview.reason }, { status: preview.status })
    }
    return NextResponse.json({ ok: true, planned: preview.planned })
  }

  const result = await restoreStaticEntity(entityName, { backupId: body.backupId, dryRun: false, actor })
  if (!result.ok) {
    if (result.status === 422) {
      return NextResponse.json({ error: result.reason }, { status: 422 })
    }
    return NextResponse.json(
      {
        error: result.error,
        partialState: result.partialState,
        rolledBack: result.rolledBack,
        safetyBackupId: result.safetyBackupId,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    restoredFiles: result.restoredFiles,
    removedRuntimeId: result.removedRuntimeId,
    migratedI18nKeyCount: result.migratedI18nKeyCount,
    safetyBackupId: result.safetyBackupId,
    redirectTo: "/admin/entities",
  })
}
