/**
 * Socket Provider - Clean React Context Provider
 *
 * Provides socket connection to the entire application using the new
 * clean SignalR architecture.
 */

"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"

import { logger } from "@/shared/logger"
import { socket } from "@/infra/socket/socket"
import { SignalRConnection } from "@/infra/socket/core/SignalRConnection"
import type { ConnectionState, ConnectionInfo } from "@/infra/socket/core/types"
import type { ExtendedSession } from "@/shared/types"
import { IS_MOCK } from "@/infra/api/mock"

// ============================================================================
// SOCKET CONTEXT
// ============================================================================

interface SocketContextValue {
  /** Current connection state */
  state: ConnectionState

  /** Full connection info */
  connectionInfo: ConnectionInfo

  /** Is connected */
  isConnected: boolean

  /** Manually reconnect */
  reconnect: () => Promise<void>

  /** Get the socket instance */
  getSocket: () => SignalRConnection
}

const SocketContext = createContext<SocketContextValue | null>(null)

// ============================================================================
// PROVIDER
// ============================================================================

interface SocketProviderProps {
  children: React.ReactNode
}

// eslint-disable-next-line max-lines-per-function -- Socket provider with connection management, event handlers, and cleanup logic
export function SocketProvider({ children }: SocketProviderProps) {
  const { data: session, status } = useSession()
  const accessToken = (session as ExtendedSession | null)?.accessToken
  const prevTokenRef = useRef<string | null>(null)

  const [state, setState] = useState<ConnectionState>("disconnected")
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(() => socket.getConnectionInfo())

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  const updateState = useCallback(() => {
    setState(socket.getState())
    setConnectionInfo(socket.getConnectionInfo())
  }, [])

  const initializeConnection = useCallback(async (token: string) => {
    try {
      logger.info("[SocketProvider] Initializing connection...")
      socket.updateToken(token)

      // If already connected, reconnect to apply new token; otherwise fresh connect
      if (socket.isConnected()) {
        await socket.reconnect()
      } else {
        await socket.connect()
      }
    } catch (error) {
      logger.warn("[SocketProvider] Connection failed (non-critical)", error)
    }
  }, [])

  const reconnect = useCallback(async () => {
    logger.info("[SocketProvider] Manual reconnect requested")
    try {
      await socket.reconnect()
    } catch (error) {
      logger.warn("[SocketProvider] Reconnect failed", error)
      throw error
    }
  }, [])

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  // Connect / disconnect based on NextAuth session token
  useEffect(() => {
    // Standalone mock mode has no backend — there is no SignalR hub to reach
    // (the socket URL would resolve to the frontend origin and 404 on negotiate).
    // Skip all connection attempts entirely.
    if (IS_MOCK) return

    if (status === "loading") return

    if (status === "authenticated" && accessToken) {
      // Only (re)connect when token actually changes
      if (prevTokenRef.current !== accessToken) {
        prevTokenRef.current = accessToken
        initializeConnection(accessToken)
      }
    } else {
      // Unauthenticated — disconnect
      if (prevTokenRef.current) {
        prevTokenRef.current = null
        socket.disconnect().catch(() => {})
      }
    }
  }, [status, accessToken, initializeConnection])

  // Subscription to state changes
  useEffect(() => {
    const subscription = socket.on("socket:state_changed", () => {
      updateState()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [updateState])

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const value = useMemo<SocketContextValue>(
    () => ({
      state,
      connectionInfo,
      isConnected: state === "connected",
      reconnect,
      getSocket: () => socket,
    }),
    [state, connectionInfo, reconnect],
  )

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <SocketContext.Provider value={value}>
      {children}

      {/* Connection Status Indicator (Development Only; hidden in mock mode — no hub to connect to) */}
      {process.env.NODE_ENV === "development" && !IS_MOCK && (
        <div className="fixed bottom-4 end-4 z-50">
          {state === "connected" ? (
            <div className="flex items-center gap-2 bg-success text-success-foreground px-3 py-1.5 rounded-full shadow-lg text-xs font-medium">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Connected
            </div>
          ) : state === "connecting" ? (
            <div className="flex items-center gap-2 bg-info text-info-foreground px-3 py-1.5 rounded-full shadow-lg text-xs font-medium">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Connecting...
            </div>
          ) : state === "reconnecting" ? (
            <div className="flex items-center gap-2 bg-warning text-warning-foreground px-3 py-1.5 rounded-full shadow-lg text-xs font-medium">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Reconnecting ({connectionInfo.reconnectAttempts})
            </div>
          ) : state === "failed" ? (
            <div className="flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full shadow-lg text-xs font-medium">
              <span className="w-2 h-2 bg-white rounded-full" />
              Failed
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-muted text-muted-foreground px-3 py-1.5 rounded-full shadow-lg text-xs font-medium">
              <span className="w-2 h-2 bg-white rounded-full" />
              Disconnected
            </div>
          )}
        </div>
      )}
    </SocketContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) {
    throw new Error("useSocketContext must be used within SocketProvider")
  }
  return ctx
}
