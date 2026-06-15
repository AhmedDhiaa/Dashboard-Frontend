/**
 * SignalR Connection - Clean, Production-Ready Implementation
 *
 * Based on proven Vue.js patterns with:
 * - Automatic reconnection with exponential backoff
 * - Group management with auto-rejoin
 * - Clean event subscription
 * - Proper error handling
 * - Token-based authentication
 */

import type * as signalR from "@microsoft/signalr"
import { logger } from "@/shared/logger"
import type { SignalRConfig, ConnectionState, ConnectionInfo, EventSubscription, EventHandler } from "./types"
import type { SignalRInternal } from "./signalr/internal"
import { buildConfig } from "./signalr/utils"
import { joinGroup as joinGroupImpl, leaveGroup as leaveGroupImpl } from "./signalr/groupOps"
import { subscribeEvent, unsubscribeEvent } from "./signalr/eventDispatch"
import { performConnect, performDisconnect } from "./signalr/lifecycle"
import { SignalRConnectionError } from "./types"

export class SignalRConnection {
  private connection: signalR.HubConnection | null = null
  private config: Required<SignalRConfig>
  private reconnectAttempts = 0
  private currentGroups = new Set<string>()
  private eventHandlers = new Map<string, Set<EventHandler>>()
  private connectionState: ConnectionState = "disconnected"
  private connectionId: string | null = null
  private connectedAt: Date | null = null
  private lastError: Error | null = null
  private connectionLock: Promise<void> | null = null
  private tokenReconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: SignalRConfig) {
    this.config = buildConfig(config)
    logger.debug("[SignalR] Connection created", { url: this.config.url })
  }

  private get _self(): SignalRInternal {
    return this as unknown as SignalRInternal
  }

  // ==========================================================================
  // CONNECTION LIFECYCLE
  // ==========================================================================

  async connect(): Promise<void> {
    // An explicit (re)connect supersedes any pending token-refresh reconnect.
    this.clearTokenReconnectTimer()
    if (this.connectionLock) {
      logger.debug("[SignalR] Waiting for existing connection attempt to complete")
      await this.connectionLock

      if (this.isConnected()) {
        logger.debug("[SignalR] Already connected after waiting")
        return
      }
    }

    this.connectionLock = performConnect(this._self)

    try {
      await this.connectionLock
    } finally {
      this.connectionLock = null
    }
  }

  async disconnect(): Promise<void> {
    this.clearTokenReconnectTimer()
    return performDisconnect(this._self)
  }

  async reconnect(): Promise<void> {
    logger.info("[SignalR] Manual reconnection requested")
    this.reconnectAttempts = 0
    await this.disconnect()
    await this.connect()
  }

  // ==========================================================================
  // GROUP MANAGEMENT
  // ==========================================================================

  async joinGroup(groupName: string): Promise<void> {
    return joinGroupImpl(this._self, groupName)
  }

  async leaveGroup(groupName: string): Promise<void> {
    return leaveGroupImpl(this._self, groupName)
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  on<T = unknown>(event: string, handler: EventHandler<T>): EventSubscription {
    return subscribeEvent<T>(this._self, event, handler, (e, h) => this.off(e, h))
  }

  off<T = unknown>(event: string, handler?: EventHandler<T>): void {
    unsubscribeEvent<T>(this._self, event, handler)
  }

  async invoke<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
    if (!this.isConnected()) {
      throw new SignalRConnectionError("Cannot invoke method: not connected")
    }

    try {
      const result = await this.connection!.invoke<T>(method, ...args)
      logger.debug(`[SignalR] Invoked method: ${method}`)
      return result
    } catch (error) {
      logger.error(`[SignalR] Method invocation failed: ${method}`, error)
      throw error
    }
  }

  async send(method: string, ...args: unknown[]): Promise<void> {
    if (!this.isConnected()) {
      throw new SignalRConnectionError("Cannot send message: not connected")
    }

    try {
      await this.connection!.send(method, ...args)
      logger.debug(`[SignalR] Sent message: ${method}`)
    } catch (error) {
      logger.error(`[SignalR] Message send failed: ${method}`, error)
      throw error
    }
  }

  // ==========================================================================
  // STATE & INFO
  // ==========================================================================

  isConnected(): boolean {
    return this.connectionState === "connected" && this.connection !== null
  }

  getState(): ConnectionState {
    return this.connectionState
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      state: this.connectionState,
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts,
      connectedAt: this.connectedAt,
      lastError: this.lastError,
    }
  }

  updateToken(token: string): void {
    if (token === this.config.token) return
    this.config.token = token
    logger.debug("[SignalR] Token updated")

    // A live connection keeps its old credential until it renegotiates, so a
    // refreshed token only takes effect on reconnect. When connected, schedule
    // a graceful, debounced reconnect (a burst of refreshes collapses into one).
    // When disconnected, the next connect() picks up the new token for free.
    if (!this.isConnected()) return
    if (this.tokenReconnectTimer) clearTimeout(this.tokenReconnectTimer)
    this.tokenReconnectTimer = setTimeout(() => {
      this.tokenReconnectTimer = null
      logger.info("[SignalR] Applying refreshed token via reconnect")
      void this.reconnect().catch(err => logger.error("[SignalR] Token-refresh reconnect failed", err))
    }, 500)
  }

  private clearTokenReconnectTimer(): void {
    if (this.tokenReconnectTimer) {
      clearTimeout(this.tokenReconnectTimer)
      this.tokenReconnectTimer = null
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  async dispose(): Promise<void> {
    this.clearTokenReconnectTimer()
    await this.disconnect()
    this.eventHandlers.clear()
    this.currentGroups.clear()
    logger.debug("[SignalR] Connection disposed")
  }
}
