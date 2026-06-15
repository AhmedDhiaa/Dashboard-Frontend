"use client"

/**
 * Encapsulates the Materialize button's click handler — confirm prompt,
 * fetch to `/api/admin/page-builder/pages/<pageId>/materialize`, and
 * surfacing the result + warnings.
 *
 * Lifted out of `PageBuilderCanvas` to keep the canvas component below
 * the project's `max-lines-per-function` ceiling.
 */

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { API_ROUTES } from "@/shared/api/routes"
import { errorReporter } from "@/infra/observability/error-reporter"
import type { useNotification } from "@/ui/application/hooks/useNotification"
import { notifySourceWrite } from "@/features/admin-tools/git-bridge/dashboard/notify-source-write"

export interface MaterializeResult {
  filesWritten: string[]
  warnings: string[]
  backupId: string | null
}

interface ResponseBody {
  filesWritten?: string[]
  warnings?: string[]
  backupId?: string | null
  error?: string
}

interface MaterializeArgs {
  pageId: string
  isDirty: boolean
  notify: ReturnType<typeof useNotification>
  /**
   * Optional registry-metadata overrides flowing from the
   * MaterializeSummaryCard. Forwarded verbatim into the POST body so
   * the route can pass them on to the registry patcher.
   */
  body?: Record<string, unknown>
}

export function useMaterializePage() {
  const [isMaterializing, setIsMaterializing] = useState(false)
  const [lastResult, setLastResult] = useState<MaterializeResult | null>(null)
  const router = useRouter()

  const trigger = useCallback(
    async ({ pageId, isDirty, notify, body: requestBody }: MaterializeArgs) => {
      if (isDirty) {
        notify.warning("admin.pageBuilder.materializeRequiresSave")
        return
      }
      if (typeof window !== "undefined") {
        const ok = window.confirm(
          `Materialize page "${pageId}"?\n\n` +
            "This writes TS source files to src/app/(dashboard)/pages/, " +
            "merges i18n keys into messages/{en,ar}/pages.json, and triggers a build cycle.\n\n" +
            "Existing files will be overwritten (a snapshot is saved to .entity-builder-backups/ first).\n\n" +
            "Continue?",
        )
        if (!ok) return
      }
      setIsMaterializing(true)
      try {
        const response = await fetch(API_ROUTES.pageBuilder.materialize(pageId), {
          method: "POST",
          credentials: "include",
          headers: requestBody ? { "Content-Type": "application/json" } : undefined,
          body: requestBody ? JSON.stringify(requestBody) : undefined,
        })
        const responseBody = (await response.json().catch(() => ({}))) as ResponseBody
        if (!response.ok) {
          notify.error(responseBody.error ?? `Materialize failed (${response.status})`)
          return
        }
        const fileCount = responseBody.filesWritten?.length ?? 1
        setLastResult({
          filesWritten: responseBody.filesWritten ?? [],
          warnings: responseBody.warnings ?? [],
          backupId: responseBody.backupId ?? null,
        })
        // Replace the per-flow success toast — materialize writes N
        // page files PLUS the registry patches (Part 3.1), so the count
        // here is real and meaningful, not a placeholder.
        notifySourceWrite(notify, fileCount, router)
      } catch (err) {
        errorReporter.captureException(err, { tags: { source: "page-builder.canvas.materialize" } })
        notify.error(err instanceof Error ? err.message : "Materialize failed")
      } finally {
        setIsMaterializing(false)
      }
    },
    [router],
  )

  const dismissResult = useCallback(() => setLastResult(null), [])

  return { isMaterializing, lastResult, trigger, dismissResult }
}
