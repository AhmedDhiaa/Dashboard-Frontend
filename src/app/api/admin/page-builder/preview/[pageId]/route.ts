/**
 * GET /api/admin/page-builder/preview/<pageId>
 *
 * Read-only preview endpoint. Returns the saved PageSchema without any
 * write side-effects — it doesn't go through `writePage` / version bump,
 * so polling it from a Preview pane is cheap.
 *
 * Distinct from `pages/[pageId]/route.ts` GET because the preview path is
 * intended for embedding (e.g. an iframe or a dev preview window) and may
 * eventually relax permissions to "anyone with the page-share link". The
 * Phase 6 implementation keeps it under `Api.Admin.PageBuilder` — link
 * sharing comes later.
 */

import { NextResponse, type NextRequest } from "next/server"
import { requirePermission } from "@/app/api/_lib/require-permission"
import { errorReporter } from "@/infra/observability/error-reporter"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { isValidPageId, readPage } from "@/features/admin-tools/page-builder/server/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
): Promise<NextResponse> {
  const guard = await requirePermission(PERMISSIONS.ADMIN_PAGE_BUILDER)
  if (!guard.ok) return guard.response
  const { pageId } = await params
  if (!isValidPageId(pageId)) return NextResponse.json({ error: "Invalid pageId" }, { status: 400 })
  try {
    const page = await readPage(pageId)
    if (!page) return NextResponse.json({ error: `No page "${pageId}"` }, { status: 404 })
    return NextResponse.json({ page })
  } catch (err) {
    errorReporter.captureException(err, { tags: { source: "page-builder.preview", pageId } })
    return NextResponse.json({ error: "Failed to read page" }, { status: 500 })
  }
}
