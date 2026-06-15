/**
 * SignalR event subscription / dispatcher registration
 */

import { logger } from "@/shared/logger"
import type { EventHandler, EventSubscription } from "../types"
import type { SignalRInternal } from "./internal"

export function registerDispatcher(self: SignalRInternal, event: string): void {
  if (!self.connection) return

  const normalizedEvent = event.toLowerCase()

  const dispatcher = (...args: unknown[]) => {
    logger.info(`[SignalR] 🛰️ RAW EVENT: ${event}`, {
      argCount: args.length,
      firstArgKeys: args[0] && typeof args[0] === "object" ? Object.keys(args[0] as object) : "primitive",
    })

    const handlers = self.eventHandlers.get(normalizedEvent)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(handler as any)(...args)
        } catch (e) {
          logger.error(`[SignalR] Error in handler for ${event}`, e)
        }
      })
    }
  }

  self.connection.on(event, dispatcher)
  if (event !== normalizedEvent) {
    self.connection.on(normalizedEvent, dispatcher)
  }
}

export function reRegisterHandlers(self: SignalRInternal): void {
  if (!self.connection) return

  logger.debug(`[SignalR] Re-registering dispatchers for ${self.eventHandlers.size} event types`)

  self.eventHandlers.forEach((_, eventName) => {
    registerDispatcher(self, eventName)
  })
}

export function subscribeEvent<T = unknown>(
  self: SignalRInternal,
  event: string,
  handler: EventHandler<T>,
  off: (event: string, handler?: EventHandler<T>) => void,
): EventSubscription {
  const normalizedEvent = event.toLowerCase()

  if (!self.eventHandlers.has(normalizedEvent)) {
    self.eventHandlers.set(normalizedEvent, new Set())

    if (self.connection) {
      registerDispatcher(self, event)
    }
  }

  self.eventHandlers.get(normalizedEvent)!.add(handler as EventHandler)
  logger.debug(
    `[SignalR] 📝 Added handler for event: ${event} (total: ${self.eventHandlers.get(normalizedEvent)!.size})`,
  )

  return {
    unsubscribe: () => off(event, handler),
  }
}

export function unsubscribeEvent<T = unknown>(self: SignalRInternal, event: string, handler?: EventHandler<T>): void {
  const normalizedEvent = event.toLowerCase()
  const handlers = self.eventHandlers.get(normalizedEvent)

  if (handler && handlers) {
    handlers.delete(handler as EventHandler)
    logger.debug(`[SignalR] 🗑️ Removed handler from event: ${event} (remaining: ${handlers.size})`)
  } else if (!handler) {
    self.eventHandlers.delete(normalizedEvent)
    if (self.connection) {
      self.connection.off(event)
      self.connection.off(normalizedEvent)
    }
    logger.debug(`[SignalR] 🗑️ Removed all handlers from event: ${event}`)
  }
}
