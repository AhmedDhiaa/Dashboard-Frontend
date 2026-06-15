"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Database } from "lucide-react"
import { EntityDataView, useRuntimeConfig } from "@/features/runtime-builder"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

export default function RuntimeEntityPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity: entityId } = use(params)
  const router = useRouter()
  const { isGranted } = usePermissionContext()
  const config = useRuntimeConfig()
  const entity = config.entities.find(e => e.id === entityId)

  // Runtime entity data is a builder/power-user surface — enforce the same
  // permission the runtime API requires (admins bypass via isGranted).
  const allowed = isGranted(PERMISSIONS.RUNTIME_MANAGE)
  useEffect(() => {
    if (!allowed) router.replace("/403")
  }, [allowed, router])
  if (!allowed) return null

  if (!entity) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Database className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">Entity not found</h2>
            <p className="text-sm text-muted-foreground">
              No runtime entity matches <code className="font-mono">{entityId}</code>. Open the Builder to create or
              restore one.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{entity.pluralName}</h1>
          {entity.description && <p className="text-sm text-muted-foreground">{entity.description}</p>}
        </div>
      </div>
      <EntityDataView entity={entity} />
    </div>
  )
}
