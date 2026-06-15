/**
 * Dynamic Page Builder route — `/pages/<pageId>`.
 *
 * Per spec §8 + §11: every page schema saved through the Page Builder
 * canvas mounts here. The route reads the schema server-side from
 * `messages/_overrides/pages/<pageId>.json`, hands it to `PageRenderer`,
 * and lets `PagePermissionGuardByKey` (already inside `PageRenderer`)
 * gate the entire render against `schema.permission`.
 *
 * Live updates happen via `PageVersionWatcher` — SignalR push triggers
 * `router.refresh()` so admin edits land for every viewer without a
 * manual reload (Phase 6 contract; the .NET emitter lands later).
 *
 * If the schema doesn't exist, return 404 via Next.js `notFound()`.
 */

import { notFound } from "next/navigation"
import { readPage } from "@/features/admin-tools/page-builder/server/storage"
import { PageRenderer } from "@/features/admin-tools/page-builder/renderer/PageRenderer"
import { PageVersionWatcher } from "./_components/PageVersionWatcher"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface RouteProps {
  params: Promise<{ pageId: string }>
}

export default async function DynamicPagePage({ params }: RouteProps) {
  const { pageId } = await params
  const schema = await readPage(pageId)
  if (!schema) notFound()

  return (
    <>
      <PageVersionWatcher pageId={pageId} />
      <PageRenderer schema={schema} />
    </>
  )
}
