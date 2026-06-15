/**
 * Hook for managing ticket detail state and actions
 */

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { logger } from "@/shared/logger"
import { useSession } from "next-auth/react"
import { useParams } from "next/navigation"
import { ticketService, ticketMessageService } from "@/domains/tickets"
import { useTicketSocket } from "./useTicketSocket"
import type { TicketMessage, BusinessPartner } from "../types"

function createOptimisticMessage(
  ticketId: string,
  text: string,
  userId: string,
  userName: string,
  note?: string,
): TicketMessage {
  return {
    id: `temp-${Date.now()}`,
    ticketId,
    text,
    note: note || "",
    date: new Date().toISOString(),
    userInfo: {
      id: userId,
      entity: { name: userName } as unknown as BusinessPartner,
    },
    tenantId: null,
    tenant: null,
    entityType: 47,
    baseId: null,
    baseRef: null,
    baseEntityType: null,
    concurrencyStamp: "",
    creator: null,
    lastModifier: null,
    deleter: null,
    isDeleted: false,
    deleterId: null,
    deletionTime: null,
    lastModificationTime: null,
    lastModifierId: null,
    creationTime: new Date().toISOString(),
    creatorId: userId,
  }
}

export function useTicketDetail() {
  const { data: session } = useSession()
  const user = session?.user as { id: string; name: string } | undefined
  const currentUserId = user?.id || "current-user"
  const currentUserName = user?.name || "Admin"
  const params = useParams()
  const ticketId = params.id as string

  // Ticket fetch is owned by React Query (caching, dedup, retry). Messages are
  // kept in local state because they're mutated live by the socket and by
  // optimistic sends; they're (re)seeded from the query result below.
  const {
    data: ticket = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => ticketService.getById(ticketId),
    enabled: !!ticketId,
  })

  const [messages, setMessages] = useState<TicketMessage[]>([])

  useEffect(() => {
    setMessages(ticket?.messages || [])
  }, [ticket])

  const { isConnected, isConnecting, connectionId } = useTicketSocket({
    ticketId,
    onMessageReceived: (newMessage: TicketMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) return prev
        return [...prev, newMessage]
      })
    },
    enabled: !!ticketId,
  })

  const handleSendMessage = async (text: string, note?: string): Promise<void> => {
    if (!ticketId) return

    try {
      const optimisticMessage = createOptimisticMessage(ticketId, text, currentUserId, currentUserName, note)
      setMessages(prev => [...prev, optimisticMessage])

      await ticketMessageService.create({
        ticketId,
        text,
        note: note || "",
        connectionId: connectionId || undefined,
      })
    } catch (err) {
      logger.error("Failed to send message:", err)
      setMessages(prev => prev.filter(m => !m.id.startsWith("temp-")))
    }
  }

  const handleUpdateMessage = async (id: string, text: string): Promise<void> => {
    try {
      const msg = messages.find(m => m.id === id)
      if (!msg) return

      setMessages(prev => prev.map(m => (m.id === id ? { ...m, text } : m)))

      await ticketMessageService.update(id, {
        text,
        concurrencyStamp: msg.concurrencyStamp,
      })
    } catch (err) {
      logger.error("Failed to update message:", err)
    }
  }

  return {
    ticket,
    messages,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load ticket") : null,
    currentUserId,
    isConnected,
    isConnecting,
    handleSendMessage,
    handleUpdateMessage,
  }
}
