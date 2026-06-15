/**
 * Tickets Domain - Public API
 */

// Types
export * from "./types"

// Services
export { ticketService } from "./ticket.service"
export { ticketMessageService } from "./ticket-message.service"

// Configuration
export { ticketConfig } from "./ticket.config"

// Hooks
export { useTicketSocket } from "./hooks/useTicketSocket"

// Components
export { TicketCard } from "./components/TicketCard"
export { CRMDetailView } from "./components/CRMDetailView"
export { MessageThread } from "./components/MessageThread"
export { MessageBubble } from "./components/MessageBubble"
export { MessageComposer } from "./components/MessageComposer"
export { ConnectionStatus } from "./components/ConnectionStatus"
