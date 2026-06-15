import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ConfigDrivenDetailPage } from "@/core/crud/components/ConfigDrivenDetailPage"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"
import { resolveEntityConfigName } from "../routes"

/** Unified detail route for every "simple" entity (see ../routes.ts). */
export default async function EntityDetailPage({ params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params
  const configName = resolveEntityConfigName(entity)
  if (!configName) notFound()

  return (
    <PagePermissionGuard entityName={configName} action="view">
      <Suspense fallback={<FormSkeleton />}>
        <ConfigDrivenDetailPage entityConfigName={configName} id={id} />
      </Suspense>
    </PagePermissionGuard>
  )
}
