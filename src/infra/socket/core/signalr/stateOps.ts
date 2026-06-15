/**
 * SignalR state mutation + state-change event emission
 */

import type { ConnectionState } from "../types"
import type { SignalRInternal } from "./internal"

export function setConnectionState(self: SignalRInternal, state: ConnectionState): void {
  self.connectionState = state

  const handlers = self.eventHandlers.get("socket:state_changed")
  if (handlers) {
    handlers.forEach(handler => handler(state))
  }

  if (state === "connected") {
    const connHandlers = self.eventHandlers.get("connected")
    if (connHandlers) connHandlers.forEach(h => h(self.getConnectionInfo()))
  } else if (state === "disconnected" || state === "failed") {
    const discHandlers = self.eventHandlers.get("disconnected")
    if (discHandlers) discHandlers.forEach(h => h(self.lastError))
  }
}
