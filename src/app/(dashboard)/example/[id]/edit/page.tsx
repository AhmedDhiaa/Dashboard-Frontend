import { Suspense } from "react"
import { ConfigDrivenEditPage } from "@/core/crud/components/ConfigDrivenEditPage"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PagePermissionGuard entityName="example" action="update">
      <Suspense fallback={<FormSkeleton />}>
        <ConfigDrivenEditPage entityConfigName="example" id={id === "create" ? undefined : id} />
      </Suspense>
    </PagePermissionGuard>
  )
}
