import { Suspense } from "react"
import { PageHeader } from "@/ui/layout/PageHeader"
import { ConfigDrivenListPage } from "@/core/crud/components/ConfigDrivenListPage"
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"

export default function WidgetsShowcase() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Full CRUD Entity"
        description="Complete list + edit + detail powered by the config-driven engine (Example UI entity)"
      />
      <Suspense fallback={<DataTableSkeleton />}>
        <ConfigDrivenListPage entityConfigName="example" />
      </Suspense>
    </div>
  )
}
