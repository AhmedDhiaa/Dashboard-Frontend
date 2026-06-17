/**
 * Socket Singleton for Infrastructure Tier
 *
 * Provides a centralized instance of the SignalRConnection for use in hooks
 * and services that require direct access to the socket.
 */

import { SignalRConnection } from "./core/SignalRConnection"
import { MockSignalRConnection } from "./core/MockSignalRConnection"
import { IS_MOCK } from "@/infra/api/mock"

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ""

const socketConfig = {
  url: SOCKET_URL,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelays: [1000, 2000, 5000, 10000, 30000],
  connectionTimeout: 30000,
}

// In standalone mock mode there is no hub to reach; the mock connection fakes
// a connected socket and emits synthetic realtime events so live-tracking UIs
// work on seeded data. Identical public surface, so callers don't branch.
export const socket: SignalRConnection = IS_MOCK
  ? new MockSignalRConnection(socketConfig)
  : new SignalRConnection(socketConfig)
