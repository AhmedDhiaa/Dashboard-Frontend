/**
 * POST /api/admin/entities/<entityName>/convert
 *
 * Promote a handwritten static entity (the `<name>.config.tsx`, `.schema.ts`,
 * `.types.ts` triad under `src/domains/`) into a JSON RuntimeEntity stored
 * under `messages/_overrides/runtime/config.json`. Source files are deleted,
 * i18n keys are moved from `pages.<entityName>.*` to
 * `pages_dynamic.<entityName>.*`, and the registry is regenerated.
 *
 * Permission: `Api.Admin.EntityBuilder` (same gate the materialize and
 * entity-builder routes use — the convert flow is the inverse of
 * materialize, so they share an authority).
 *
 * Env gate: APP_ALLOW_RUNTIME_CODEGEN=true. The route 404s in
 * production AND when the gate isn't set, matching the materialize
 * route's posture. Convert deletes source files and mutates the i18n
 * tree — the gate keeps it strictly opt-in.
 *
 * Modes:
 *   ?dryRun=true → returns the planned change set ({ runtimeEntityId,
 *                  filesToDelete[], i18nKeysToMigrate }) without writing.
 *   (no flag)    → executes the full convert. On any post-parse failure
 *                  the rollback contract in convert.ts restores state
 *                  byte-for-byte from the pre-flight snapshot.
 */

import { NextResponse, type NextRequest } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { convertStaticEntity, previewConvert } from "./_lib/convert"
import type { ExtendedSession } from "@/shared/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_ENTITY_BUILDER
const RUNTIME_GATE = "APP_ALLOW_RUNTIME_CODEGEN"

// Mirrors the parser + isValidEntityId pattern: lowercase kebab, 1-41 chars.
// Captured here as a literal so the route can 400 before touching the parser.
const ENTITY_NAME_PATTERN = /^[a-z][a-z0-9-]{0,40}$/

type RouteContext = { params: Promise<{ entityName: string }> }

function actorOf(session: ExtendedSession): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

// `notFound` masks the route's existence in production / when the env gate is
// off. Mirrors the materialize route's posture — admins who don't have the
// runtime-codegen env should not learn this endpoint exists.
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

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"

  if (dryRun) {
    const preview = await previewConvert(entityName)
    if (!preview.ok) {
      return NextResponse.json({ error: preview.reason, filePath: preview.filePath }, { status: 422 })
    }
    return NextResponse.json({ ok: true, planned: preview.planned })
  }

  const result = await convertStaticEntity(entityName, { actor: actorOf(guard.session) })
  if (!result.ok) {
    if (result.status === 422) {
      return NextResponse.json({ error: result.reason, filePath: result.filePath }, { status: 422 })
    }
    return NextResponse.json(
      { error: result.error, backupId: result.backupId, rolledBack: result.rolledBack },
      { status: 500 },
    )
  }

  const body: Record<string, unknown> = {
    runtimeEntityId: result.runtimeEntityId,
    backupId: result.backupId,
    deletedFiles: result.deletedFiles,
    migratedI18nKeyCount: result.migratedI18nKeyCount,
    redirectTo: result.redirectTo,
  }
  if (result.auditWarning) body.auditWarning = result.auditWarning
  return NextResponse.json(body)
}
