import { Suspense } from "react"
import { ConfigDrivenDetailPage } from "@/core/crud/components/ConfigDrivenDetailPage"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PagePermissionGuard entityName="example" action="view">
      <Suspense fallback={<FormSkeleton />}>
        <ConfigDrivenDetailPage entityConfigName="example" id={id} />
      </Suspense>
    </PagePermissionGuard>
  )
}
