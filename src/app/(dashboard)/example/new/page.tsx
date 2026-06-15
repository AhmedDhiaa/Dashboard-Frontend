/**
 * Vehicle Park Create Page - Using ConfigDrivenEditPage
 */

import { ConfigDrivenEditPage } from "@/core/crud/components/ConfigDrivenEditPage"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"

export default function ExampleNewPage() {
  return (
    <PagePermissionGuard entityName="example" action="create">
      <ConfigDrivenEditPage entityConfigName="example" />
    </PagePermissionGuard>
  )
}
