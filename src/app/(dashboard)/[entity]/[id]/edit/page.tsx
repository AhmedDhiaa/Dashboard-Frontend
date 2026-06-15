import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ConfigDrivenEditPage } from "@/core/crud/components/ConfigDrivenEditPage"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"
import { resolveEntityConfigName } from "../../routes"

/**
 * Unified create/edit route for every "simple" entity (see ../../routes.ts).
 * `/<entity>/create/edit` arrives as id="create" → undefined (create mode),
 * matching the per-entity edit pages this replaces.
 */
export default async function EntityEditPage({ params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params
  const configName = resolveEntityConfigName(entity)
  if (!configName) notFound()

  return (
    <PagePermissionGuard entityName={configName} action="update">
      <Suspense fallback={<FormSkeleton />}>
        <ConfigDrivenEditPage entityConfigName={configName} id={id === "create" ? undefined : id} />
      </Suspense>
    </PagePermissionGuard>
  )
}
