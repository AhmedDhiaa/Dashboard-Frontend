/**
 * SignalR pure helpers
 */

import type * as signalR from "@microsoft/signalr"
import type { SignalRConfig } from "../types"
import { SignalRConnectionError, SignalRAuthenticationError, SignalRTimeoutError } from "../types"

// Numeric literal for HttpTransportType.WebSockets — avoids a runtime import
// of @microsoft/signalr just to read an enum value. The signalR package is
// loaded lazily inside `performConnect`, so module evaluation cost stays
// near zero. The cast preserves type-checking against the upstream enum.
const WEBSOCKETS_TRANSPORT = 1 as signalR.HttpTransportType

export const DEFAULT_CONFIG = {
  maxReconnectAttempts: 5,
  reconnectDelays: [1000, 2000, 5000, 10000, 30000],
  connectionTimeout: 30000,
  autoReconnect: true,
} as const

export function buildConfig(config: SignalRConfig): Required<SignalRConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    url: config.url ?? "",
    token: config.token ?? "",
    reconnectDelays: Array.from(config.reconnectDelays || DEFAULT_CONFIG.reconnectDelays),
    headers: config.headers ?? {},
    transport: config.transport ?? WEBSOCKETS_TRANSPORT,
  }
}

export function calculateReconnectDelay(delays: number[], attemptNumber: number): number {
  return delays[Math.min(attemptNumber, delays.length - 1)] ?? 1000
}

export function wrapError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.includes("unauthorized") || error.message.includes("401")) {
      return new SignalRAuthenticationError(error.message)
    }
    if (error.message.includes("timeout")) {
      return new SignalRTimeoutError(error.message)
    }
    return new SignalRConnectionError(error.message, error)
  }
  return new SignalRConnectionError(String(error))
}
