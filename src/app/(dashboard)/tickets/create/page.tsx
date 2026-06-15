import { ConfigDrivenEditPage } from "@/core/crud/components/ConfigDrivenEditPage"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"

export default function TicketCreatePage() {
  return (
    <PagePermissionGuard entityName="ticket" action="create">
      <ConfigDrivenEditPage entityConfigName="ticket" />
    </PagePermissionGuard>
  )
}
