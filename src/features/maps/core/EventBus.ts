/**
 * Event Bus - Decoupled event communication system for map features
 */

import { logger } from "@/shared/logger"
import type { EventDataMap, EventHandler } from "./event-types"

/**
 * Event subscription
 */
interface EventSubscription {
  event: string
  handler: EventHandler
  once: boolean
}

/**
 * Event Bus for map system
 */
export class EventBus {
  private subscriptions: Map<string, EventSubscription[]> = new Map()

  /**
   * Subscribe to an event with type safety
   */
  on<K extends keyof EventDataMap>(event: K, handler: EventHandler<EventDataMap[K]>): () => void
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void
  on(event: string, handler: EventHandler): () => void {
    const subscriptions = this.subscriptions.get(event) || []

    const subscription: EventSubscription = {
      event,
      handler,
      once: false,
    }

    subscriptions.push(subscription)
    this.subscriptions.set(event, subscriptions)

    logger.debug(`[EventBus] Subscribed to: ${event}`)

    // Return unsubscribe function
    return () => this.off(event, handler)
  }

  /**
   * Subscribe to an event (fires only once) with type safety
   */
  once<K extends keyof EventDataMap>(event: K, handler: EventHandler<EventDataMap[K]>): () => void
  once<T = unknown>(event: string, handler: EventHandler<T>): () => void
  once(event: string, handler: EventHandler): () => void {
    const subscriptions = this.subscriptions.get(event) || []

    const subscription: EventSubscription = {
      event,
      handler,
      once: true,
    }

    subscriptions.push(subscription)
    this.subscriptions.set(event, subscriptions)

    logger.debug(`[EventBus] Subscribed once to: ${event}`)

    return () => this.off(event, handler)
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: EventHandler): void {
    const subscriptions = this.subscriptions.get(event)

    if (!subscriptions) return

    const filtered = subscriptions.filter(sub => sub.handler !== handler)

    if (filtered.length > 0) {
      this.subscriptions.set(event, filtered)
    } else {
      this.subscriptions.delete(event)
    }

    logger.debug(`[EventBus] Unsubscribed from: ${event}`)
  }

  /**
   * Emit an event with type safety
   */
  emit<K extends keyof EventDataMap>(event: K, data: EventDataMap[K]): void
  emit<T = unknown>(event: string, data?: T): void
  emit(event: string, data?: unknown): void {
    const subscriptions = this.subscriptions.get(event)

    if (!subscriptions || subscriptions.length === 0) {
      logger.debug(`[EventBus] No subscribers for: ${event}`)
      return
    }

    logger.debug(`[EventBus] Emitting: ${event} to ${subscriptions.length} subscribers`)

    // Process subscriptions
    const remaining: EventSubscription[] = []

    subscriptions.forEach(subscription => {
      try {
        subscription.handler(data)
      } catch (error) {
        logger.error(`[EventBus] Error in ${event} handler:`, error)
      }

      // Keep subscription if not "once"
      if (!subscription.once) {
        remaining.push(subscription)
      }
    })

    // Update subscriptions (remove "once" handlers)
    if (remaining.length > 0) {
      this.subscriptions.set(event, remaining)
    } else {
      this.subscriptions.delete(event)
    }
  }

  /**
   * Clear all subscriptions for an event
   */
  clear(event?: string): void {
    if (event) {
      this.subscriptions.delete(event)
      logger.debug(`[EventBus] Cleared event: ${event}`)
    } else {
      this.subscriptions.clear()
      logger.debug(`[EventBus] Cleared all events`)
    }
  }

  /**
   * Get list of all events with subscribers
   */
  getEvents(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * Get subscriber count for an event
   */
  getSubscriberCount(event: string): number {
    return this.subscriptions.get(event)?.length || 0
  }

  /**
   * Check if an event has subscribers
   */
  hasSubscribers(event: string): boolean {
    return this.getSubscriberCount(event) > 0
  }
}
