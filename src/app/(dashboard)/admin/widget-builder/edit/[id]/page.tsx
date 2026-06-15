"use client"

/**
 * /admin/widget-builder/edit/<id> — fetch the saved widget, hand it to
 * the wizard pre-filled, and forward `update` mode so saving overwrites.
 */

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { WidgetBuilderWizard } from "@/features/admin-tools/widget-builder"
import { fetchWidget } from "@/features/admin-tools/widget-builder/dashboard/api"
import type { WidgetBuilderSchema } from "@/features/admin-tools/widget-builder/types/widget-schema"

export default function Page() {
  const params = useParams<{ id: string }>()
  const [widget, setWidget] = useState<WidgetBuilderSchema | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.id) return
    fetchWidget(params.id)
      .then(setWidget)
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load widget"))
  }, [params.id])

  if (error) {
    return (
      <div className="p-12 text-center text-destructive">
        <p className="font-semibold">Failed to load widget</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    )
  }
  if (!widget) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
  }
  return <WidgetBuilderWizard prefillSchema={widget} mode="update" />
}
