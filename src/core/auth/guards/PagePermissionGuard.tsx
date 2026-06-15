"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useEntityPermissions } from "@/core/auth/context/PermissionContext"
import { useEntityConfig } from "@/core/entities/hooks"
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"

interface PagePermissionGuardProps {
  /**
   * Entity short name (e.g. "city"), matching `entityName` in the entity config.
   * The guard resolves the real ABP permission key (e.g. "Api.City") from the config —
   * passing the short name here would otherwise miss the real granted permission.
   */
  entityName: string
  action: "view" | "create" | "update" | "delete"
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PagePermissionGuard({ entityName, action, children, fallback }: PagePermissionGuardProps) {
  const router = useRouter()
  const { config, isLoading: isConfigLoading } = useEntityConfig(entityName)
  const perms = useEntityPermissions(config?.permissionKey)

  const ready = !isConfigLoading && !!config
  const allowed =
    ready &&
    (action === "view"
      ? perms.canView
      : action === "create"
        ? perms.canCreate
        : action === "update"
          ? perms.canUpdate
          : action === "delete"
            ? perms.canDelete
            : false)

  useEffect(() => {
    if (ready && !allowed && !fallback) router.replace("/403")
  }, [ready, allowed, fallback, router])

  if (!allowed) return fallback ? <>{fallback}</> : <DataTableSkeleton />
  return <>{children}</>
}
