/**
 * Ticket Message API Service
 */

import { BaseCRUDService } from "@/infra/api"
import type { TicketMessage, SendMessageRequest, UpdateMessageRequest } from "./types"

class TicketMessageService extends BaseCRUDService<TicketMessage, SendMessageRequest, UpdateMessageRequest> {
  constructor() {
    super("/ticket-message")
  }
}

export const ticketMessageService = new TicketMessageService()
