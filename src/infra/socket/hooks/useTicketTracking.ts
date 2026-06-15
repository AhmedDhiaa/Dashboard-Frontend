"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSocketContext } from "@/infra/socket/components/SocketProvider"
import { logger } from "@/shared/logger"
import type { TicketMessageDto, EventSubscription } from "../core/types"

// ============================================================================
// TYPES
// ============================================================================

export interface UseTicketTrackingOptions {
  /** Ticket ID to track (Guid) - optional, can be set later via joinTicketGroup */
  ticketId?: string | null

  /** Callback when receiving ticket message */
  onReceiveTicketMessage?: (message: TicketMessageDto) => void

  /** Auto-join on mount (default: true) */
  autoJoin?: boolean

  /** Callback on error */
  onError?: (error: Error) => void
}

export interface UseTicketTrackingReturn {
  /** Join ticket group */
  joinTicketGroup: (ticketId: string) => Promise<void>

  /** Leave current ticket group */
  leaveTicketGroup: () => Promise<void>

  /** Current ticket ID being tracked */
  currentTicketId: string | null

  /** Whether currently tracking a ticket */
  isTracking: boolean

  /** Whether connected to SignalR */
  isConnected: boolean

  /** Latest received message */
  latestMessage: TicketMessageDto | null
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

// eslint-disable-next-line max-lines-per-function
export function useTicketTracking(options: UseTicketTrackingOptions = {}): UseTicketTrackingReturn {
  const { ticketId: initialTicketId = null, onReceiveTicketMessage, autoJoin = true, onError } = options

  const { isConnected, getSocket } = useSocketContext()
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(initialTicketId)
  const [latestMessage, setLatestMessage] = useState<TicketMessageDto | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const eventSubscriptionRef = useRef<EventSubscription | null>(null)

  // Store callbacks in refs to prevent re-subscriptions
  const onReceiveTicketMessageRef = useRef(onReceiveTicketMessage)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onReceiveTicketMessageRef.current = onReceiveTicketMessage
    onErrorRef.current = onError
  }, [onReceiveTicketMessage, onError])

  // Handle incoming messages
  const handleMessage = useCallback((message: TicketMessageDto) => {
    logger.info("[useTicketTracking] 📨 Received message from SignalR", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messageId: (message as any).messageId || (message as any).id, // SignalR message ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ticketId: (message as any).ticketId, // SignalR ticket ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: (message as any).content?.substring(0, 50), // SignalR message content
    })
    setLatestMessage(message)
    onReceiveTicketMessageRef.current?.(message)
  }, [])

  // ==========================================================================
  // EVENT SUBSCRIPTION
  // ==========================================================================

  useEffect(() => {
    const socket = getSocket()

    if (!isConnected || !socket) {
      logger.debug("[useTicketTracking] Waiting for connection before subscribing")
      return
    }

    // Subscribe to ReceiveTicketMessage event
    const subscription = socket.on<TicketMessageDto>("ReceiveTicketMessage", handleMessage)
    eventSubscriptionRef.current = subscription

    logger.info("[useTicketTracking] ✅ Subscribed to ReceiveTicketMessage event")

    return () => {
      subscription?.unsubscribe()
      eventSubscriptionRef.current = null
      logger.debug("[useTicketTracking] Unsubscribed from ReceiveTicketMessage")
    }
  }, [isConnected, handleMessage, getSocket])

  // ==========================================================================
  // GROUP MANAGEMENT
  // ==========================================================================

  const joinTicketGroup = useCallback(
    async (ticketId: string) => {
      if (!ticketId) {
        throw new Error("Ticket ID is required")
      }

      const socket = getSocket()
      if (!isConnected || !socket) {
        logger.warn("[useTicketTracking] Cannot join: not connected")
        return
      }

      try {
        logger.info(`[useTicketTracking] 🔗 Calling JoinTicketGroup with ticketId: ${ticketId}`)

        // Call the specific JoinTicketGroup(Guid ticketId) method
        await socket.invoke("JoinTicketGroup", ticketId)

        setCurrentTicketId(ticketId)
        setIsTracking(true)

        logger.info(`[useTicketTracking] ✅ Successfully joined ticket group: ${ticketId}`)
      } catch (error) {
        logger.error(`[useTicketTracking] ❌ Failed to join ticket group: ${ticketId}`, error)
        onErrorRef.current?.(error as Error)
        throw error
      }
    },
    [isConnected, getSocket],
  )

  const leaveTicketGroup = useCallback(async () => {
    const socket = getSocket()
    if (!currentTicketId || !isConnected || !socket) {
      return
    }

    try {
      logger.info(`[useTicketTracking] Leaving ticket group: ${currentTicketId}`)

      // Call the specific LeaveTicketGroup(Guid ticketId) method
      await socket.invoke("LeaveTicketGroup", currentTicketId)

      setCurrentTicketId(null)
      setIsTracking(false)
      setLatestMessage(null)

      logger.info("[useTicketTracking] Left ticket group")
    } catch (error) {
      logger.error("[useTicketTracking] Failed to leave ticket group", error)
      onErrorRef.current?.(error as Error)
    }
  }, [currentTicketId, isConnected, getSocket])

  // ==========================================================================
  // AUTO-JOIN ON MOUNT / CONNECTION
  // ==========================================================================

  useEffect(() => {
    if (!autoJoin || !currentTicketId) {
      return
    }

    if (isConnected && !isTracking) {
      logger.info(`[useTicketTracking] Auto-joining ticket group: ${currentTicketId}`)

      joinTicketGroup(currentTicketId)
    }
  }, [autoJoin, currentTicketId, isConnected, isTracking, joinTicketGroup])

  // ==========================================================================
  // SYNC INITIAL TICKET ID
  // ==========================================================================

  useEffect(() => {
    if (initialTicketId && initialTicketId !== currentTicketId) {
      setCurrentTicketId(initialTicketId)
    }
  }, [initialTicketId, currentTicketId])

  // ==========================================================================
  // AUTO-LEAVE ON UNMOUNT
  // ==========================================================================

  useEffect(() => {
    return () => {
      if (isTracking && currentTicketId) {
        // Fire and forget - cleanup
        leaveTicketGroup().catch(error => {
          logger.error("[useTicketTracking] Cleanup leave failed", error)
        })
      }
    }
  }, [isTracking, currentTicketId, leaveTicketGroup])

  // ==========================================================================
  // RETURN API
  // ==========================================================================

  return {
    joinTicketGroup,
    leaveTicketGroup,
    currentTicketId,
    isTracking,
    isConnected,
    latestMessage,
  }
}
