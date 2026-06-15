"use client"

/**
 * Encapsulates the canvas Save action — POST/PUT to the page CRUD API,
 * SignalR fan-out for live preview tabs, plus toast feedback. Lifted out
 * of `PageBuilderCanvas` to keep that component below the project's
 * `max-lines-per-function` ceiling.
 *
 * SignalR live-reload is gated behind `NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD`
 * (default off). The .NET hub does not yet expose a `PageUpdated` method
 * — invoking it raises a `HubException: Method does not exist` that
 * pollutes the console without breaking the save itself. The flag stays
 * off until the backend lands the method; flipping it on is a one-line
 * env change at that point. When on, a missing method is logged at
 * debug level (gated by `NEXT_PUBLIC_LOG_LEVEL`) — never reported to
 * Sentry, since it's an expected dev-mode condition while the contract
 * matures.
 */

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { API_ROUTES } from "@/shared/api/routes"
import { errorReporter } from "@/infra/observability/error-reporter"
import { useSocketContext } from "@/infra/socket/components/SocketProvider"
import { logger } from "@/shared/logger"
import type { useNotification } from "@/ui/application/hooks/useNotification"
import { notifySourceWrite } from "@/features/admin-tools/git-bridge/dashboard/notify-source-write"
import type { PageSchema } from "../../schema/page-schema"

interface SaveArgs {
  schema: PageSchema
  notify: ReturnType<typeof useNotification>
  onSaved: () => void
}

/**
 * Read at call time rather than module load so tests can flip the flag
 * via `vi.stubEnv` without re-importing. In production builds Next.js
 * inlines the literal at build time, so the call-site read is just a
 * cheap object access; the runtime cost is negligible.
 */
function isLiveReloadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD === "true"
}

export function useSavePage() {
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const { isConnected, getSocket } = useSocketContext()

  const trigger = useCallback(
    async ({ schema, notify, onSaved }: SaveArgs) => {
      setIsSaving(true)
      try {
        const pageId = schema.id
        // PUT first, fall back to POST when the page doesn't exist yet.
        let response = await fetch(API_ROUTES.pageBuilder.item(pageId), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(schema),
        })
        if (response.status === 404) {
          response = await fetch(API_ROUTES.pageBuilder.list, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(schema),
          })
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `Save failed (${response.status})`)
        }
        onSaved()
        // Replace the per-flow success toast with the unified
        // source-write toast. The page-builder save writes one page
        // JSON entry — fileCount = 1.
        notifySourceWrite(notify, 1, router)
        // Live-reload is feature-flagged off until the .NET hub ships
        // a `PageUpdated` method matching the `ReceivePageSchemaChanged`
        // contract. See PageVersionWatcher for the consumer side.
        if (isLiveReloadEnabled() && isConnected) {
          await tryBroadcastPageUpdate(getSocket, pageId)
        }
      } catch (err) {
        errorReporter.captureException(err, { tags: { source: "page-builder.canvas.save" } })
        notify.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setIsSaving(false)
      }
    },
    [isConnected, getSocket, router],
  )

  return { isSaving, trigger }
}

/**
 * Best-effort SignalR fan-out. Failure here is non-fatal — the save
 * succeeded on the server already; the broadcast just lets other open
 * tabs refresh. A missing hub method is the expected condition until
 * the backend ships, so we log at debug (gated, silent in prod) rather
 * than reporting to Sentry.
 */
async function tryBroadcastPageUpdate(
  getSocket: ReturnType<typeof useSocketContext>["getSocket"],
  pageId: string,
): Promise<void> {
  try {
    await getSocket().invoke("PageUpdated", pageId)
  } catch (err) {
    logger.debug("[page-builder] PageUpdated invoke failed (non-fatal)", err)
  }
}
