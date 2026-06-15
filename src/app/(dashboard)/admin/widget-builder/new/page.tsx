"use client"

import nextDynamic from "next/dynamic"

const WidgetBuilderWizard = nextDynamic(
  () => import("@/features/admin-tools/widget-builder").then(m => m.WidgetBuilderWizard),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div> },
)

export default function Page() {
  return <WidgetBuilderWizard />
}
