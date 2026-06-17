"use client"

/**
 * Client shell for the live-tracking route. Loads the Leaflet-backed map view
 * via `next/dynamic({ ssr: false })` — Leaflet touches `window`, and keeping it
 * in an async chunk holds the route's first-load JS under budget.
 */

import dynamic from "next/dynamic"
import { useT } from "@/shared/config"
import { PageHeader } from "@/ui/layout/PageHeader"

const LiveTrackingView = dynamic(() => import("./LiveTrackingView"), {
  ssr: false,
  loading: () => <div className="h-[560px] w-full animate-pulse rounded-xl bg-muted" />,
})

export function TrackingClient() {
  const t = useT("pages_tracking")
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <LiveTrackingView />
    </div>
  )
}
