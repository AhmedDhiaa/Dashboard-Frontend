"use client"

/**
 * Admin tools are gated by permission and rarely visited; lazy-loading
 * the feature module keeps it out of the shared chunk and out of the
 * server-rendered HTML for non-admins.
 */

import nextDynamic from "next/dynamic"

const WidgetBuilderDashboard = nextDynamic(
  () => import("@/features/admin-tools/widget-builder").then(m => m.WidgetBuilderDashboard),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div> },
)

export default function Page() {
  return <WidgetBuilderDashboard />
}
