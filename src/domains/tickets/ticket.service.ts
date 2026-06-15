/**
 * Ticket API Service
 */

import { BaseCRUDService } from "@/infra/api"
import type { Ticket, CreateTicketRequest } from "./types"

class TicketService extends BaseCRUDService<Ticket, CreateTicketRequest, Partial<Omit<Ticket, "id">>> {
  constructor() {
    super("/ticket")
  }

  /**
   * Close a ticket
   */
  async close(id: string): Promise<void> {
    await this.client.post(`${this.endpoint}/close/${id}`, {})
  }

  /**
   * Get autocomplete suggestions for tickets
   */
  override async autocomplete(params?: Record<string, unknown>): Promise<Ticket[]> {
    const response = await this.client.get<{ items: Ticket[] }>(`${this.endpoint}/autocomplete`, { params })
    return response.data.items
  }
}

export const ticketService = new TicketService()
