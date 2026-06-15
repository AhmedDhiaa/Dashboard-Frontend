/**
 * GET  /api/admin/page-builder/pages       — list page summaries
 * POST /api/admin/page-builder/pages       — create a new page (body = full PageSchema)
 *
 * All operations:
 *   - gated by `Api.Admin.PageBuilder` (rate-limited to 30/min/IP — see config.ts)
 *   - run the body through `pageSchema.parse(...)` BEFORE touching disk
 *   - go through `assertSafePath` via the storage helpers (no fs primitive
 *     ever sees a raw path)
 *   - append a structured audit line on every attempt (success / failure /
 *     refused) so admin actions are traceable
 */

import { NextResponse, type NextRequest } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { errorReporter } from "@/infra/observability/error-reporter"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { pageSchema } from "@/features/admin-tools/page-builder/schema/page-schema"
import { listPages, readPage, writePage } from "@/features/admin-tools/page-builder/server/storage"
import { appendAudit, hashSchema } from "@/features/admin-tools/page-builder/server/audit"
import { mergePageI18n } from "@/features/admin-tools/page-builder/server/i18n-merge"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function actorOf(session: { user?: { email?: string | null; name?: string | null } | null }): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

export async function GET(): Promise<NextResponse> {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response
  try {
    const pages = await listPages()
    return NextResponse.json({ pages })
  } catch (err) {
    errorReporter.captureException(err, { tags: { source: "page-builder.pages.list" } })
    return NextResponse.json({ error: "Failed to list pages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response
  const actor = actorOf(guard.session)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "create",
      pageId: "(unknown)",
      outcome: "refused",
      schemaHash: null,
      blockCount: null,
      error: "Invalid JSON",
    })
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = pageSchema.safeParse(body)
  if (!parsed.success) {
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "create",
      pageId: typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : "(unknown)",
      outcome: "refused",
      schemaHash: null,
      blockCount: null,
      error: "Schema validation failed",
    })
    return NextResponse.json({ error: "Schema validation failed", issues: parsed.error.issues }, { status: 400 })
  }

  const pageId = parsed.data.id
  const existing = await readPage(pageId)
  if (existing) {
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "create",
      pageId,
      outcome: "refused",
      schemaHash: hashSchema(parsed.data),
      blockCount: parsed.data.blocks.length,
      error: "Page already exists — use PUT to update",
    })
    return NextResponse.json({ error: `Page "${pageId}" already exists` }, { status: 409 })
  }

  try {
    const result = await writePage(pageId, parsed.data)
    const i18n = await mergePageI18n(result.schema)
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "create",
      pageId,
      outcome: "success",
      schemaHash: hashSchema(result.schema),
      blockCount: result.schema.blocks.length,
      error: null,
    })
    return NextResponse.json(
      {
        page: result.schema,
        version: result.version,
        i18n: { keysWritten: i18n.keysWritten, warnings: i18n.warnings },
      },
      { status: 201 },
    )
  } catch (err) {
    errorReporter.captureException(err, { tags: { source: "page-builder.pages.create", pageId } })
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "create",
      pageId,
      outcome: "failure",
      schemaHash: hashSchema(parsed.data),
      blockCount: parsed.data.blocks.length,
      error: err instanceof Error ? err.message : "Unknown error",
    })
    return NextResponse.json({ error: "Failed to write page" }, { status: 500 })
  }
}
