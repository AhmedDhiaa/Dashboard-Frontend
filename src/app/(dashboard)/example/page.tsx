import { Suspense } from "react"
import { ConfigDrivenListPage } from "@/core/crud/components/ConfigDrivenListPage"
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"

export default function Page() {
  return (
    <PagePermissionGuard entityName="example" action="view">
      <Suspense fallback={<DataTableSkeleton />}>
        <ConfigDrivenListPage entityConfigName="example" />
      </Suspense>
    </PagePermissionGuard>
  )
}
