"use client"

/**
 * /admin/page-builder — the page list/dashboard.
 *
 * Previously this route rendered the canvas directly with a hardcoded
 * "draft-page" schema, so every save overwrote the same draft and there was
 * no way to open a specific page. It now lists saved pages and routes into
 * the canvas via `+ New page` (create) or the per-row Edit action
 * (`/admin/page-builder/edit/<pageId>`).
 *
 * Loaded via `next/dynamic` (ssr:false) so the admin-only list fetch runs
 * after hydration and the bundle stays off non-admin routes.
 */

import nextDynamic from "next/dynamic"

const PageBuilderDashboard = nextDynamic(
  () => import("@/features/admin-tools/page-builder/dashboard/PageBuilderDashboard").then(m => m.PageBuilderDashboard),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div> },
)

export default function Page() {
  return <PageBuilderDashboard />
}
