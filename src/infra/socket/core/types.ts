/**
 * Socket Types - Consolidated Type Definitions
 *
 * All type definitions for the socket subsystem in one place
 */

import type * as signalR from "@microsoft/signalr"

// ============================================================================
// CONNECTION CONFIGURATION
// ============================================================================

export interface SignalRConfig {
  /** SignalR hub URL */
  url: string

  /** Authentication token */
  token?: string

  /** Maximum reconnection attempts (0 = unlimited) */
  maxReconnectAttempts?: number

  /** Custom reconnection delays in milliseconds */
  reconnectDelays?: number[]

  /** Connection timeout in milliseconds */
  connectionTimeout?: number

  /** Additional headers */
  headers?: Record<string, string>

  /** Transport type */
  transport?: signalR.HttpTransportType

  /** Enable automatic reconnection */
  autoReconnect?: boolean
}

// ============================================================================
// CONNECTION STATE
// ============================================================================

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "failed"

export interface ConnectionInfo {
  state: ConnectionState
  connectionId: string | null
  reconnectAttempts: number
  connectedAt: Date | null
  lastError: Error | null
}

// ============================================================================
// EVENT SUBSCRIPTION
// ============================================================================

export interface EventSubscription {
  unsubscribe: () => void
}

export type EventHandler<T = unknown> = (data: T) => void

// ============================================================================
// DOMAIN-SPECIFIC TYPES (from your application)
// ============================================================================

export interface TicketMessageDto {
  id: string
  ticketId: string
  content: string
  senderId: string
  senderName: string
  senderRole: "CUSTOMER" | "AGENT" | "SYSTEM"
  timestamp: Date
  attachments?: string[]
}

export interface DriverTrackingDto {
  driverId: string
  code?: string // Driver code (e.g., "EMP-0001")
  name?: string // Driver name
  driverName?: string // Alternative name field (backward compatibility)
  location?: {
    lat: number
    lng: number
  }
  locationPoint?: {
    longitude: number
    latitude: number
    angle: number
  }
  longitude?: number // Alternative location format
  latitude?: number // Alternative location format
  status?: "available" | "busy" | "offline"
  isWork?: boolean // Real-time work status
  currentOrderId?: string
  speed?: number
  heading?: number
  angle?: number
  timestamp?: Date | number
  id?: string // Alternative ID field
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SignalRError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown,
  ) {
    super(message)
    this.name = "SignalRError"
  }
}

export class SignalRConnectionError extends SignalRError {
  constructor(message: string, originalError?: unknown) {
    super(message, "CONNECTION_ERROR", originalError)
    this.name = "SignalRConnectionError"
  }
}

export class SignalRAuthenticationError extends SignalRError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTH_ERROR")
    this.name = "SignalRAuthenticationError"
  }
}

export class SignalRTimeoutError extends SignalRError {
  constructor(message: string = "Connection timeout") {
    super(message, "TIMEOUT_ERROR")
    this.name = "SignalRTimeoutError"
  }
}
