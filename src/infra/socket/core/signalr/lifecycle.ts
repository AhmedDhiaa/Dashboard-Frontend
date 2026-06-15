/**
 * SignalR connection lifecycle: connect, disconnect, hub event handlers
 */

import type * as signalR from "@microsoft/signalr"
import { logger } from "@/shared/logger"
import { SignalRTimeoutError } from "../types"
import type { SignalRInternal } from "./internal"
import { calculateReconnectDelay, wrapError } from "./utils"
import { rejoinGroups } from "./groupOps"
import { reRegisterHandlers } from "./eventDispatch"
import { setConnectionState } from "./stateOps"

// `@microsoft/signalr` ships ~25 KB gzipped. Loading it eagerly inflates
// the shared bundle on every page even though the connection isn't built
// until login completes. Cache the dynamic import so re-connects don't
// re-fetch the chunk.
let signalRPromise: Promise<typeof signalR> | null = null
function loadSignalR(): Promise<typeof signalR> {
  if (!signalRPromise) {
    signalRPromise = import("@microsoft/signalr")
  }
  return signalRPromise
}

export async function performConnect(self: SignalRInternal): Promise<void> {
  if (self.connection) {
    logger.warn("[SignalR] Connection already exists, disconnecting first")
    await self.disconnect()
  }

  try {
    setConnectionState(self, "connecting")
    const signalR = await loadSignalR()
    const connectionBuilder = new signalR.HubConnectionBuilder()
      .withUrl(self.config.url, {
        accessTokenFactory: self.config.token ? () => self.config.token! : undefined,
        transport:
          self.config.transport || signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents,
        headers: self.config.headers,
      })
      .configureLogging(
        process.env.NODE_ENV === "development" ? signalR.LogLevel.Information : signalR.LogLevel.Warning,
      )

    if (self.config.autoReconnect) {
      connectionBuilder.withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          if (retryContext.previousRetryCount < self.config.maxReconnectAttempts) {
            const delay = calculateReconnectDelay(self.config.reconnectDelays, retryContext.previousRetryCount)
            logger.info(`[SignalR] Reconnect attempt ${retryContext.previousRetryCount + 1}, delay: ${delay}ms`)
            return delay
          }
          logger.error("[SignalR] Max reconnect attempts reached")
          return null
        },
      })
    }

    self.connection = connectionBuilder.build()

    setupConnectionHandlers(self)
    reRegisterHandlers(self)

    const startPromise = self.connection.start()
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new SignalRTimeoutError()), self.config.connectionTimeout)
    })

    await Promise.race([startPromise, timeoutPromise])

    self.reconnectAttempts = 0
    self.connectionId = self.connection.connectionId || null
    self.connectedAt = new Date()
    setConnectionState(self, "connected")
    self.lastError = null

    logger.info("[SignalR] Connected successfully", {
      connectionId: self.connectionId,
    })

    await rejoinGroups(self)
  } catch (error) {
    self.reconnectAttempts++
    self.lastError = error as Error
    setConnectionState(self, "failed")

    const wrapped = wrapError(error)
    logger.error("[SignalR] Connection failed", wrapped)

    if (self.config.autoReconnect && self.reconnectAttempts < self.config.maxReconnectAttempts) {
      const delay = calculateReconnectDelay(self.config.reconnectDelays, self.reconnectAttempts - 1)
      logger.info(`[SignalR] Retrying connection in ${delay}ms...`)
      setTimeout(() => self.connect(), delay)
      return
    }

    throw wrapped
  }
}

export async function performDisconnect(self: SignalRInternal): Promise<void> {
  if (self.connectionLock) {
    logger.debug("[SignalR] Waiting for connection attempt to complete before disconnecting")
    try {
      await self.connectionLock
    } catch (error) {
      logger.debug("[SignalR] Connection attempt failed while waiting to disconnect", error)
    }
  }

  if (!self.connection) {
    return
  }

  try {
    setConnectionState(self, "disconnected")
    await self.connection.stop()
    self.connection = null
    self.connectionId = null
    self.connectedAt = null
    self.currentGroups.clear()

    logger.info("[SignalR] Disconnected")
  } catch (error) {
    if (error instanceof Error && error.message.includes("stop() was called")) {
      logger.debug("[SignalR] Ignored stop-before-start race condition error")
      self.connection = null
      self.connectionId = null
      self.connectedAt = null
      self.currentGroups.clear()
      return
    }

    logger.error("[SignalR] Disconnect error", error)
    throw error
  }
}

export function setupConnectionHandlers(self: SignalRInternal): void {
  if (!self.connection) return

  self.connection.onreconnecting(() => {
    setConnectionState(self, "reconnecting")
    self.reconnectAttempts++
    logger.warn(`[SignalR] Reconnecting (attempt ${self.reconnectAttempts})`)
  })

  self.connection.onreconnected(connectionId => {
    setConnectionState(self, "connected")
    self.connectionId = connectionId || null
    self.reconnectAttempts = 0
    self.connectedAt = new Date()
    logger.info("[SignalR] Reconnected", { connectionId: self.connectionId })

    rejoinGroups(self).catch(error => {
      logger.error("[SignalR] Failed to rejoin groups after reconnection", error)
    })
  })

  self.connection.onclose(error => {
    setConnectionState(self, "disconnected")
    self.connectionId = null
    self.connectedAt = null

    if (error) {
      self.lastError = error
      logger.error("[SignalR] Connection closed with error", error)
    } else {
      logger.info("[SignalR] Connection closed")
    }
  })
}
