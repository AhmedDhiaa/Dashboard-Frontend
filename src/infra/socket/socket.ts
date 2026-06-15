/**
 * Socket Singleton for Infrastructure Tier
 *
 * Provides a centralized instance of the SignalRConnection for use in hooks
 * and services that require direct access to the socket.
 */

import { SignalRConnection } from "./core/SignalRConnection"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ""

export const socket = new SignalRConnection({
  url: SOCKET_URL,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelays: [1000, 2000, 5000, 10000, 30000],
  connectionTimeout: 30000,
})
