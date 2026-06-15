/**
 * Shared internal accessor shape used by SignalR helper modules.
 * Mirrors the mutable state of SignalRConnection.
 */

import type * as signalR from "@microsoft/signalr"
import type { SignalRConfig, ConnectionState, ConnectionInfo, EventHandler } from "../types"

export interface SignalRInternal {
  connection: signalR.HubConnection | null
  config: Required<SignalRConfig>
  reconnectAttempts: number
  currentGroups: Set<string>
  eventHandlers: Map<string, Set<EventHandler>>
  connectionState: ConnectionState
  connectionId: string | null
  connectedAt: Date | null
  lastError: Error | null
  connectionLock: Promise<void> | null

  // Public-ish methods used during lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  getConnectionInfo(): ConnectionInfo
}
