/**
 * Ticket Detail Page - Shows ticket with integrated chat
 *
 * Server component: this file just composes two client children
 * (`PagePermissionGuard` + `CRMDetailView`). The page itself ships no
 * JS — only the children do, via their own `"use client"` boundaries.
 */

import { CRMDetailView } from "@/domains/tickets/components/CRMDetailView"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"

export default function TicketDetailPage() {
  return (
    <PagePermissionGuard entityName="ticket" action="view">
      <CRMDetailView />
    </PagePermissionGuard>
  )
}
