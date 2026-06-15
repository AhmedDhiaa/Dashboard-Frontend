"use client"

import { use } from "react"
import { LayoutDashboard } from "lucide-react"
import { DashboardView, useRuntimeConfig } from "@/features/runtime-builder"
import { Card, CardContent } from "@/ui/design-system/primitives/card"

export default function RuntimeDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const config = useRuntimeConfig()
  const dashboard = config.dashboards.find(d => d.id === id)

  if (!dashboard) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <LayoutDashboard className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">Dashboard not found</h2>
            <p className="text-sm text-muted-foreground">
              No runtime dashboard matches <code className="font-mono">{id}</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{dashboard.title}</h1>
          <p className="text-xs text-muted-foreground">{dashboard.widgets.length} widget(s)</p>
        </div>
      </div>
      <DashboardView dashboardId={dashboard.id} />
    </div>
  )
}
