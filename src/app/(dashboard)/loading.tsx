// Server component (no "use client") — the route-segment loading UI renders on
// the server with zero hydration cost, so the skeleton paints instantly on
// navigation instead of waiting for the client bundle to hydrate it.
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8">
      <DataTableSkeleton />
    </div>
  )
}
