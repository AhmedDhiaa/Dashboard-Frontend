"use client"

/**
 * Watches the i18n override version and refreshes the dashboard when it
 * changes, so admin edits land for every signed-in user without a reload.
 *
 * Transport: SignalR (push). Mounted in the dashboard layout.
 *
 * Server contract
 * ---------------
 * The backend MUST broadcast `ReceiveTranslationVersionChanged` to every
 * authenticated socket whenever an admin publishes new overrides:
 *
 *   { version: number }      // monotonically increasing per publish
 *
 * No group join is required — translation overrides are global. If the
 * backend stops emitting this event, dashboards won't see fresh overrides
 * until the user navigates or reloads. (Removing the periodic 30 s
 * `/api/i18n/version` poll was a deliberate move to push-only; the prior
 * fallback masked broken backend wiring.)
 *
 * Boot path: a single mount-time fetch establishes the baseline AND
 * catches publishes that happened between SSR and SignalR connect (a
 * pure-push baseline would miss those). Anything thereafter rides the
 * push channel — no setInterval.
 */

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSocketContext } from "@/infra/socket/components/SocketProvider"
import { logger } from "@/shared/logger"
import { API_ROUTES } from "@/shared/api/routes"

const TRANSLATION_VERSION_EVENT = "ReceiveTranslationVersionChanged"

export function TranslationVersionWatcher(): null {
  const router = useRouter()
  const lastVersion = useRef<number | null>(null)
  const { isConnected, getSocket } = useSocketContext()

  // Mount-time baseline + SSR→connect-gap catch-up. One-shot, no interval.
  useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch(API_ROUTES.i18n.version, { cache: "no-store", signal: ac.signal })
        if (!res.ok) return
        const { version } = (await res.json()) as { version: number }
        if (lastVersion.current === null) {
          lastVersion.current = version
        } else if (version > lastVersion.current) {
          lastVersion.current = version
          router.refresh()
        }
      } catch {
        // Transient network error or aborted on unmount — push channel
        // will catch the next publish.
      }
    })()
    return () => ac.abort()
  }, [router])

  // Live updates via SignalR push.
  useEffect(() => {
    if (!isConnected) return
    const socket = getSocket()
    const subscription = socket.on<{ version: number }>(TRANSLATION_VERSION_EVENT, payload => {
      const remote = payload?.version
      if (typeof remote !== "number") return
      if (lastVersion.current === null) {
        lastVersion.current = remote
        return
      }
      if (remote > lastVersion.current) {
        lastVersion.current = remote
        router.refresh()
      }
    })
    return () => {
      try {
        subscription.unsubscribe()
      } catch (err) {
        logger.warn("[TranslationVersionWatcher] unsubscribe failed", err)
      }
    }
  }, [isConnected, getSocket, router])

  return null
}
