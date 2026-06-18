/**
 * Ticket API Service
 */

import { BaseCRUDService } from "@/infra/api"
import { abpGetItems, abpPostAction } from "@/infra/api/adapters/abp/crud-extras"
import type { Ticket, CreateTicketRequest } from "./types"

class TicketService extends BaseCRUDService<Ticket, CreateTicketRequest, Partial<Omit<Ticket, "id">>> {
  constructor() {
    super("/ticket")
  }

  /** Close a ticket. */
  close(id: string): Promise<void> {
    return abpPostAction(this.endpoint, "close", id)
  }

  /** Get autocomplete suggestions for tickets. */
  override autocomplete(params?: Record<string, unknown>): Promise<Ticket[]> {
    return abpGetItems<Ticket>(this.endpoint, "autocomplete", params)
  }
}

export const ticketService = new TicketService()
