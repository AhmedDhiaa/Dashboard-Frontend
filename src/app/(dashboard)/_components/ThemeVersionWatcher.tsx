"use client"

/**
 * Watches the published-theme version and refreshes the dashboard when
 * the publish counter changes — re-runs the server layout, which re-reads
 * the theme override file and re-emits the SSR `<style>` block. Users see
 * the new tokens within a render cycle, no reload needed.
 *
 * Transport: SignalR (push). Mounted in the dashboard layout. Same shape
 * as TranslationVersionWatcher; intentionally duplicated rather than
 * abstracted because the deps are tiny and a generic
 * "VersionedRefreshWatcher" would obscure intent at call sites.
 *
 * Server contract
 * ---------------
 * Backend MUST broadcast `ReceiveThemeVersionChanged` to every
 * authenticated socket whenever an admin publishes a theme:
 *
 *   { version: number }      // monotonically increasing per publish
 *
 * No group join is required — themes are global. If the event stops
 * being emitted, dashboards won't see new themes until reload.
 */

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSocketContext } from "@/infra/socket/components/SocketProvider"
import { logger } from "@/shared/logger"
import { API_ROUTES } from "@/shared/api/routes"

const THEME_VERSION_EVENT = "ReceiveThemeVersionChanged"

export function ThemeVersionWatcher(): null {
  const router = useRouter()
  const lastVersion = useRef<number | null>(null)
  const { isConnected, getSocket } = useSocketContext()

  // Mount-time baseline + SSR→connect-gap catch-up. One-shot, no interval.
  useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch(API_ROUTES.theme.version, { cache: "no-store", signal: ac.signal })
        if (!res.ok) return
        const { version } = (await res.json()) as { version: number }
        if (lastVersion.current === null) {
          lastVersion.current = version
        } else if (version > lastVersion.current) {
          lastVersion.current = version
          router.refresh()
        }
      } catch {
        // Transient network error or aborted on unmount.
      }
    })()
    return () => ac.abort()
  }, [router])

  // Live updates via SignalR push.
  useEffect(() => {
    if (!isConnected) return
    const socket = getSocket()
    const subscription = socket.on<{ version: number }>(THEME_VERSION_EVENT, payload => {
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
        logger.warn("[ThemeVersionWatcher] unsubscribe failed", err)
      }
    }
  }, [isConnected, getSocket, router])

  return null
}
