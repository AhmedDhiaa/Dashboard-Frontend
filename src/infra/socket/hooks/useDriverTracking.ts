"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useSocketContext } from "@/infra/socket/components/SocketProvider"
import { logger } from "@/shared/logger"
import type { DriverTrackingDto, EventSubscription } from "../core/types"

// ============================================================================
// TYPES
// ============================================================================

export interface UseDriverTrackingOptions {
  /** Callback when receiving driver tracking update */
  onReceiveDriverTracking?: (tracking: DriverTrackingDto) => void

  /** Auto-join on mount (default: true) */
  autoJoin?: boolean

  /** Throttle updates (ms) - prevents too frequent re-renders (default: 500ms) */
  throttleMs?: number

  /** Callback on error */
  onError?: (error: Error) => void
}

export interface UseDriverTrackingReturn {
  /** Join global driver tracking group */
  joinDriverTrackingGroup: () => Promise<void>

  /** Leave driver tracking group */
  leaveDriverTrackingGroup: () => Promise<void>

  /** Whether currently tracking drivers */
  isTracking: boolean

  /** Whether connected to SignalR */
  isConnected: boolean

  /** Latest driver tracking data */
  latestDriverTracking: DriverTrackingDto | null

  /** All driver locations (keyed by driver ID) */
  driverLocations: Map<string, DriverTrackingDto>
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

// eslint-disable-next-line max-lines-per-function
export function useDriverTracking(options: UseDriverTrackingOptions = {}): UseDriverTrackingReturn {
  const { onReceiveDriverTracking, autoJoin = true, throttleMs = 500, onError } = options

  const { isConnected, getSocket } = useSocketContext()
  const [latestDriverTracking, setLatestDriverTracking] = useState<DriverTrackingDto | null>(null)
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverTrackingDto>>(new Map())
  const [isTracking, setIsTracking] = useState(false)
  const eventSubscriptionRef = useRef<EventSubscription | null>(null)

  // Throttling state
  const lastUpdateRef = useRef<number>(0)
  const pendingUpdateRef = useRef<DriverTrackingDto | null>(null)
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Store callbacks in refs
  const onReceiveDriverTrackingRef = useRef(onReceiveDriverTracking)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onReceiveDriverTrackingRef.current = onReceiveDriverTracking
    onErrorRef.current = onError
  }, [onReceiveDriverTracking, onError])

  // Process driver update
  const processDriverUpdate = useCallback((tracking: DriverTrackingDto) => {
    // Support both driverId and id fields (backend sends 'id', interface expects 'driverId')
    const driverId = tracking.driverId || tracking.id

    if (!driverId) {
      logger.warn("[useDriverTracking] Received tracking update without driverId or id", tracking)
      return
    }

    // Extract best available coordinates
    const lat = tracking.locationPoint?.latitude ?? tracking.location?.lat ?? tracking.latitude
    const lng = tracking.locationPoint?.longitude ?? tracking.location?.lng ?? tracking.longitude

    logger.debug("[useDriverTracking] Processing driver update", {
      driverId,
      lat,
      lng,
      status: tracking.status,
    })

    lastUpdateRef.current = Date.now()

    // Normalize the tracking object
    const normalizedTracking: DriverTrackingDto = {
      ...tracking,
      driverId,
      location: lat != null && lng != null ? { lat, lng } : tracking.location,
    }

    setLatestDriverTracking(normalizedTracking)

    // Update driver locations map
    setDriverLocations(prev => {
      const next = new Map(prev)
      next.set(driverId, normalizedTracking)
      return next
    })

    onReceiveDriverTrackingRef.current?.(normalizedTracking)
  }, [])

  // Handle incoming driver tracking with throttling
  const handleDriverTracking = useCallback(
    (tracking: DriverTrackingDto) => {
      const now = Date.now()

      // Store the latest update
      pendingUpdateRef.current = tracking

      // Check if we should throttle
      if (now - lastUpdateRef.current < throttleMs) {
        // Schedule update for later if not already scheduled
        if (!throttleTimerRef.current) {
          throttleTimerRef.current = setTimeout(
            () => {
              if (pendingUpdateRef.current) {
                processDriverUpdate(pendingUpdateRef.current)
                pendingUpdateRef.current = null
              }
              throttleTimerRef.current = null
            },
            throttleMs - (now - lastUpdateRef.current),
          )
        }
        return
      }

      // Process immediately
      processDriverUpdate(tracking)
    },
    [throttleMs, processDriverUpdate],
  )

  // ==========================================================================
  // EVENT SUBSCRIPTION
  // ==========================================================================

  useEffect(() => {
    const socket = getSocket()

    if (!isConnected || !socket) {
      logger.debug("[useDriverTracking] Waiting for connection before subscribing")
      return
    }

    // Subscribe to ReceiveDriverTracking event
    const subscription = socket.on<DriverTrackingDto>("ReceiveDriverTracking", handleDriverTracking)
    eventSubscriptionRef.current = subscription

    logger.info("[useDriverTracking] ✅ Subscribed to ReceiveDriverTracking event")

    return () => {
      subscription?.unsubscribe()
      eventSubscriptionRef.current = null

      // Clear throttle timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }

      logger.debug("[useDriverTracking] Unsubscribed from ReceiveDriverTracking")
    }
  }, [isConnected, handleDriverTracking, getSocket])

  // ==========================================================================
  // GROUP MANAGEMENT
  // ==========================================================================

  const joinDriverTrackingGroup = useCallback(async () => {
    const socket = getSocket()
    if (!isConnected || !socket) {
      logger.warn("[useDriverTracking] Cannot join: not connected")
      return
    }

    try {
      logger.info("[useDriverTracking] 🔗 Calling JoinDriverTrackingGroup")

      // Call the specific JoinDriverTrackingGroup() method (no parameters)
      await socket.invoke("JoinDriverTrackingGroup")

      setIsTracking(true)

      logger.info("[useDriverTracking] ✅ Successfully joined driver tracking group")
    } catch (error) {
      // Check if error is due to connection being closed
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes("connection being closed") || errorMessage.includes("Invocation canceled")) {
        logger.warn("[useDriverTracking] ⚠️ Join canceled due to connection closure, will retry on reconnect")
        // Don't throw - this is expected during reconnection
        return
      }

      logger.error("[useDriverTracking] ❌ Failed to join driver tracking group", error)
      onErrorRef.current?.(error as Error)
      throw error
    }
  }, [isConnected, getSocket])

  const leaveDriverTrackingGroup = useCallback(async () => {
    const socket = getSocket()
    if (!isConnected || !socket) {
      return
    }

    try {
      logger.info("[useDriverTracking] Leaving driver tracking group")

      // Call the specific LeaveDriverTrackingGroup() method
      // Note: Backend doesn't support this method yet
      // await socket.invoke('LeaveDriverTrackingGroup');

      setIsTracking(false)
      setLatestDriverTracking(null)
      setDriverLocations(new Map())

      logger.info("[useDriverTracking] Left driver tracking group")
    } catch (error) {
      logger.error("[useDriverTracking] Failed to leave driver tracking group", error)
      onErrorRef.current?.(error as Error)
    }
  }, [isConnected, getSocket])

  // ==========================================================================
  // AUTO-JOIN ON MOUNT / CONNECTION
  // ==========================================================================

  useEffect(() => {
    if (!autoJoin) {
      return
    }

    if (isConnected && !isTracking) {
      logger.info("[useDriverTracking] Auto-joining driver tracking group")

      joinDriverTrackingGroup()
    }
  }, [autoJoin, isConnected, isTracking, joinDriverTrackingGroup])

  // ==========================================================================
  // AUTO-LEAVE ON UNMOUNT
  // ==========================================================================

  useEffect(() => {
    return () => {
      if (isTracking) {
        leaveDriverTrackingGroup().catch(error => {
          logger.error("[useDriverTracking] Cleanup leave failed", error)
        })
      }
    }
  }, [isTracking, leaveDriverTrackingGroup])

  // ==========================================================================
  // RETURN API
  // ==========================================================================

  return {
    joinDriverTrackingGroup,
    leaveDriverTrackingGroup,
    isTracking,
    isConnected,
    latestDriverTracking,
    driverLocations,
  }
}
