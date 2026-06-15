"use client"

/**
 * /admin/page-builder/edit/<pageId> — fetch a saved page and hand its
 * schema to the canvas pre-filled. Saving from the canvas PUTs back to the
 * same id (see useSavePage), so edits persist to the page that was opened.
 *
 * Mirrors the widget-builder edit route's load → canvas pattern.
 */

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import nextDynamic from "next/dynamic"
import { fetchPage } from "@/features/admin-tools/page-builder/dashboard/api"
import type { PageSchema } from "@/features/admin-tools/page-builder/schema/page-schema"

const PageBuilderCanvas = nextDynamic(
  () => import("@/features/admin-tools/page-builder/canvas/PageBuilderCanvas").then(m => m.PageBuilderCanvas),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Loading canvas…</div> },
)

export default function Page() {
  const params = useParams<{ pageId: string }>()
  const [page, setPage] = useState<PageSchema | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.pageId) return
    fetchPage(params.pageId)
      .then(setPage)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load page"))
  }, [params.pageId])

  if (error) {
    return (
      <div className="p-12 text-center text-destructive">
        <p className="font-semibold">Failed to load page</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    )
  }
  if (!page) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
  }
  return <PageBuilderCanvas initialSchema={page} />
}
