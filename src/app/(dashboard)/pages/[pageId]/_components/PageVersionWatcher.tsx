"use client"

/**
 * Mirrors `TranslationVersionWatcher`: subscribes to a SignalR push event
 * and triggers `router.refresh()` when the page schema for the current
 * pageId changes. Mounted inside the dynamic `/pages/[pageId]` route.
 *
 * Server contract
 * ---------------
 * The .NET backend MUST broadcast `ReceivePageSchemaChanged` to every
 * authenticated socket whenever a Page Builder admin saves:
 *
 *   { pageId: string, version: number }
 *
 * The watcher only refreshes when `payload.pageId === currentPageId` —
 * other pages' edits don't churn unrelated tabs.
 *
 * Phase 6 ships the listener even though no .NET broadcast exists yet.
 * Without the broadcast, refresh-on-edit doesn't happen, but the schema
 * still loads correctly on every navigation. Phase 7+ wires the backend
 * emitter alongside the materialize pipeline.
 */

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSocketContext } from "@/infra/socket/components/SocketProvider"
import { logger } from "@/shared/logger"

const PAGE_SCHEMA_EVENT = "ReceivePageSchemaChanged"

interface PageVersionWatcherProps {
  pageId: string
}

export function PageVersionWatcher({ pageId }: PageVersionWatcherProps): null {
  const router = useRouter()
  const lastVersion = useRef<number | null>(null)
  const { isConnected, getSocket } = useSocketContext()

  useEffect(() => {
    if (!isConnected) return
    const socket = getSocket()
    const subscription = socket.on<{ pageId: string; version: number }>(PAGE_SCHEMA_EVENT, payload => {
      if (!payload || payload.pageId !== pageId) return
      const remote = payload.version
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
        logger.warn("[PageVersionWatcher] unsubscribe failed", err)
      }
    }
  }, [isConnected, getSocket, pageId, router])

  return null
}
