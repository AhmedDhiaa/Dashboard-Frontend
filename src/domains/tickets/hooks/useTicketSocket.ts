/**
 * Ticket Socket Hook
 *
 * Provides real-time messaging capabilities for tickets using SignalR
 */

import { useEffect, useCallback, useState } from "react"
import { socket } from "@/infra/socket"
import { IS_MOCK } from "@/infra/api/mock"
import type { TicketMessage } from "../types"
import { logger } from "@/shared/logger"

interface UseTicketSocketOptions {
  ticketId: string | null
  onMessageReceived?: (message: TicketMessage) => void
  enabled?: boolean
}

interface UseTicketSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  connectionId: string | null
  sendMessage: (text: string, note?: string) => Promise<void>
  joinTicketGroup: (ticketId: string) => Promise<void>
  leaveTicketGroup: (ticketId: string) => Promise<void>
}

/**
 * Hook for managing real-time ticket messaging via SignalR
 */
export function useTicketSocket({
  ticketId,
  onMessageReceived,
  enabled = true,
}: UseTicketSocketOptions): UseTicketSocketReturn {
  const [isConnected, setIsConnected] = useState(socket.isConnected())
  const [isConnecting, setIsConnecting] = useState(socket.getState() === "connecting")
  const [connectionId, setConnectionId] = useState<string | null>(socket.getConnectionInfo().connectionId)

  // Join ticket group
  const joinTicketGroup = useCallback(async (id: string) => {
    try {
      await socket.invoke("JoinTicketGroup", id)
      logger.info(`Joined ticket group: ${id}`)
    } catch (error) {
      logger.error("Failed to join ticket group", { error, ticketId: id })
      throw error
    }
  }, [])

  // Leave ticket group
  const leaveTicketGroup = useCallback(async (id: string) => {
    try {
      await socket.invoke("LeaveTicketGroup", id)
      logger.info(`Left ticket group: ${id}`)
    } catch (error) {
      logger.error("Failed to leave ticket group", { error, ticketId: id })
    }
  }, [])

  // Send message
  const sendMessage = useCallback(
    async (text: string, note?: string) => {
      if (!ticketId || !connectionId) {
        throw new Error("Cannot send message: not connected to ticket")
      }

      try {
        await socket.invoke("SendTicketMessage", {
          ticketId,
          text,
          note: note || "",
          connectionId,
        })
        logger.info("Message sent successfully", { ticketId })
      } catch (error) {
        logger.error("Failed to send message", { error, ticketId })
        throw error
      }
    },
    [ticketId, connectionId],
  )

  // Handle connection state changes
  useEffect(() => {
    // Standalone mock mode has no SignalR backend — never attempt to connect.
    if (!enabled || IS_MOCK) return

    const handleStateChange = (state: string) => {
      setIsConnected(state === "connected")
      setIsConnecting(state === "connecting" || state === "reconnecting")

      if (state === "connected") {
        setConnectionId(socket.getConnectionInfo().connectionId)
      } else {
        setConnectionId(null)
      }
    }

    const stateSub = socket.on("socket:state_changed", handleStateChange)

    // Connect if not already connected
    if (!socket.isConnected() && socket.getState() !== "connecting") {
      socket.connect().catch(error => {
        logger.error("Failed to connect socket", { error })
      })
    }

    return () => {
      stateSub.unsubscribe()
    }
  }, [enabled])

  // Handle ticket group joining
  useEffect(() => {
    if (!enabled || !isConnected || !ticketId) return

    joinTicketGroup(ticketId)

    // Note: No cleanup needed - backend doesn't support LeaveTicketGroup
  }, [enabled, isConnected, ticketId, joinTicketGroup])

  // Handle incoming messages
  useEffect(() => {
    if (!enabled || !onMessageReceived) return

    const handleMessageReceived = (event: unknown) => {
      // Support both wrapped (MessageReceivedEvent) and flat (TicketMessage) structures
      const data = event as { message?: TicketMessage; ticketId?: string } & Partial<TicketMessage>
      const message = data?.message || (data as TicketMessage)
      const ticketIdFromEvent = data?.ticketId || message?.ticketId

      logger.info("Message received", { ticketId: ticketIdFromEvent, id: message?.id })

      if (message && message.id) {
        onMessageReceived(message)
      }
    }

    socket.on("ReceiveTicketMessage", handleMessageReceived)

    return () => {
      socket.off("ReceiveTicketMessage", handleMessageReceived)
    }
  }, [enabled, onMessageReceived])

  return {
    isConnected,
    isConnecting,
    connectionId,
    sendMessage,
    joinTicketGroup,
    leaveTicketGroup,
  }
}
