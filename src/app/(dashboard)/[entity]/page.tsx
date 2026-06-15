import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ConfigDrivenListPage } from "@/core/crud/components/ConfigDrivenListPage"
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"
import { resolveEntityConfigName } from "./routes"

/**
 * Unified list route for every "simple" entity (see ./routes.ts). Resolves the
 * URL slug to its config name and renders the generic list page — identical
 * behaviour to a hand-written per-entity page, with zero per-entity files.
 */
export default async function EntityListPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params
  const configName = resolveEntityConfigName(entity)
  if (!configName) notFound()

  return (
    <PagePermissionGuard entityName={configName} action="view">
      <Suspense fallback={<DataTableSkeleton />}>
        <ConfigDrivenListPage entityConfigName={configName} />
      </Suspense>
    </PagePermissionGuard>
  )
}
