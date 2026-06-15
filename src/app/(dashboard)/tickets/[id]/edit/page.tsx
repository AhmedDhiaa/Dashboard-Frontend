import { Suspense } from "react"
import { ConfigDrivenEditPage } from "@/core/crud/components/ConfigDrivenEditPage"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PagePermissionGuard entityName="ticket" action="update">
      <Suspense fallback={<FormSkeleton />}>
        <ConfigDrivenEditPage entityConfigName="ticket" id={id === "create" ? undefined : id} />
      </Suspense>
    </PagePermissionGuard>
  )
}
