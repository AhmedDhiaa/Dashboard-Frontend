import { BaseCRUDService } from "@/infra/api/crud-service"
import type { NotificationFormValues, NotificationUpdateFormValues } from "./notification.schema"

export interface Notification {
  id: string
  type: number
  status?: number
  title: string
  body: string
  note?: string | null
  baseId: string
  baseRef: string
  baseEntityType: number
  userInfo: {
    id: string
    entity?: Record<string, unknown>
  }
  tenantId?: string | null
  tenant?: unknown
  entityType?: number
  concurrencyStamp?: string
  creator?: unknown
  lastModifier?: unknown
  deleter?: unknown
  isDeleted?: boolean
  deleterId?: string | null
  deletionTime?: string | null
  lastModificationTime?: string | null
  lastModifierId?: string | null
  creationTime?: string
  creatorId?: string | null
}

class NotificationService extends BaseCRUDService<Notification, NotificationFormValues, NotificationUpdateFormValues> {
  constructor() {
    super("/notification")
  }

  // Add custom methods if needed
  async getCurrentList() {
    const response = await this.client.get<{ items: Notification[]; totalCount: number }>(
      `${this.endpoint}/current-list`,
    )
    return response.data
  }
}

export const notificationService = new NotificationService()
