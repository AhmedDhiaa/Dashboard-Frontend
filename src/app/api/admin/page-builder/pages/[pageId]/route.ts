/**
 * GET    /api/admin/page-builder/pages/<pageId> — fetch full PageSchema
 * PUT    /api/admin/page-builder/pages/<pageId> — replace existing page
 * DELETE /api/admin/page-builder/pages/<pageId> — remove page
 */

import { NextResponse, type NextRequest } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { errorReporter } from "@/infra/observability/error-reporter"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { pageSchema } from "@/features/admin-tools/page-builder/schema/page-schema"
import { deletePage, isValidPageId, readPage, writePage } from "@/features/admin-tools/page-builder/server/storage"
import { appendAudit, hashSchema } from "@/features/admin-tools/page-builder/server/audit"
import { mergePageI18n, removePageI18n } from "@/features/admin-tools/page-builder/server/i18n-merge"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ pageId: string }>
}

function actorOf(session: { user?: { email?: string | null; name?: string | null } | null }): string | null {
  return session.user?.email ?? session.user?.name ?? null
}

export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response
  const { pageId } = await params
  if (!isValidPageId(pageId)) return NextResponse.json({ error: "Invalid pageId" }, { status: 400 })
  try {
    const page = await readPage(pageId)
    if (!page) return NextResponse.json({ error: `No page "${pageId}"` }, { status: 404 })
    return NextResponse.json({ page })
  } catch (err) {
    errorReporter.captureException(err, { tags: { source: "page-builder.pages.read", pageId } })
    return NextResponse.json({ error: "Failed to read page" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response
  const { pageId } = await params
  const actor = actorOf(guard.session)

  if (!isValidPageId(pageId)) {
    return NextResponse.json({ error: "Invalid pageId" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "update",
      pageId,
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
      operation: "update",
      pageId,
      outcome: "refused",
      schemaHash: null,
      blockCount: null,
      error: "Schema validation failed",
    })
    return NextResponse.json({ error: "Schema validation failed", issues: parsed.error.issues }, { status: 400 })
  }

  if (parsed.data.id !== pageId) {
    return NextResponse.json({ error: "URL pageId does not match schema.id" }, { status: 400 })
  }

  const existing = await readPage(pageId)
  if (!existing) {
    return NextResponse.json({ error: `No page "${pageId}" — use POST to create` }, { status: 404 })
  }

  try {
    const result = await writePage(pageId, parsed.data)
    const i18n = await mergePageI18n(result.schema)
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "update",
      pageId,
      outcome: "success",
      schemaHash: hashSchema(result.schema),
      blockCount: result.schema.blocks.length,
      error: null,
    })
    return NextResponse.json({
      page: result.schema,
      version: result.version,
      i18n: { keysWritten: i18n.keysWritten, warnings: i18n.warnings },
    })
  } catch (err) {
    errorReporter.captureException(err, { tags: { source: "page-builder.pages.update", pageId } })
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "update",
      pageId,
      outcome: "failure",
      schemaHash: hashSchema(parsed.data),
      blockCount: parsed.data.blocks.length,
      error: err instanceof Error ? err.message : "Unknown error",
    })
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response
  const { pageId } = await params
  const actor = actorOf(guard.session)

  if (!isValidPageId(pageId)) {
    return NextResponse.json({ error: "Invalid pageId" }, { status: 400 })
  }

  try {
    const result = await deletePage(pageId)
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "delete",
      pageId,
      outcome: result.removed ? "success" : "refused",
      schemaHash: null,
      blockCount: null,
      error: result.removed ? null : "Page not found",
    })
    if (!result.removed) return NextResponse.json({ error: `No page "${pageId}"` }, { status: 404 })
    const i18nRemoval = await removePageI18n(pageId)
    return NextResponse.json({ removed: true, version: result.version, i18n: i18nRemoval })
  } catch (err) {
    errorReporter.captureException(err, { tags: { source: "page-builder.pages.delete", pageId } })
    await appendAudit({
      timestamp: new Date().toISOString(),
      actor,
      operation: "delete",
      pageId,
      outcome: "failure",
      schemaHash: null,
      blockCount: null,
      error: err instanceof Error ? err.message : "Unknown error",
    })
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 })
  }
}
