"use client"

/**
 * Encapsulates the editor CRUD interactions: initial fetch, save, revert,
 * batch publish. Calls `router.refresh()` after each mutation so the
 * version-keyed request.ts cache picks up the change immediately.
 *
 * Two write paths share this hook — the override store and the direct
 * source writer — selected via SOURCE_WRITE_ENABLED. The read path still
 * targets /api/i18n/overrides regardless: in source-write mode the store
 * is empty (good — the active overrides view correctly shows nothing),
 * and in override mode it shows the current overrides as before.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useNotification } from "@/ui/application"
import { notifySourceWrite } from "@/features/admin-tools/git-bridge/dashboard/notify-source-write"
import type { KeyDescriptor, PendingEdit } from "../types"
import { deleteOverride, deleteSource, fetchOverrides, patchOverride, patchSource } from "../api"
import { SOURCE_WRITE_ENABLED } from "../lib/write-mode"

interface Args {
  enabled: boolean
  locale: "en" | "ar"
  pending: ReadonlyMap<string, PendingEdit>
  discardPending: (flatKey: string) => void
}

/**
 * Resolve the (namespace, keyPath) the write endpoints expect.
 *
 * A `t()` call made with the namespace-less hook (`useT()`) records its
 * descriptor as namespace="" + keyPath="<ns>.<rest>" (e.g.
 * "nav.supply_services"). The source-write endpoint requires a non-empty
 * namespace, so when the recorded namespace is empty we split the first dotted
 * segment off as the namespace. This is a no-op for already-namespaced
 * descriptors and for genuine top-level keys (no dot).
 */
function resolveTarget(descriptor: KeyDescriptor): { namespace: string; keyPath: string } {
  if (descriptor.namespace) return { namespace: descriptor.namespace, keyPath: descriptor.keyPath }
  const dot = descriptor.keyPath.indexOf(".")
  if (dot > 0) {
    return { namespace: descriptor.keyPath.slice(0, dot), keyPath: descriptor.keyPath.slice(dot + 1) }
  }
  return { namespace: descriptor.namespace, keyPath: descriptor.keyPath }
}

export interface OverrideMutations {
  overrides: Record<string, string>
  saveEdit: (descriptor: KeyDescriptor, value: string) => Promise<number>
  revertOverride: (descriptor: KeyDescriptor) => Promise<number>
  publishAll: () => Promise<void>
}

export function useOverrideMutations({ enabled, locale, pending, discardPending }: Args): OverrideMutations {
  const router = useRouter()
  const notifications = useNotification()
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetchOverrides(locale)
      .then(map => {
        if (!cancelled) setOverrides(map)
      })
      .catch(() => {
        /* tolerate empty map */
      })
    return () => {
      cancelled = true
    }
  }, [enabled, locale])

  const saveEdit = useCallback(
    async (descriptor: KeyDescriptor, value: string) => {
      const patch = SOURCE_WRITE_ENABLED ? patchSource : patchOverride
      const { namespace, keyPath } = resolveTarget(descriptor)
      const result = await patch(locale, namespace, keyPath, value)
      // patchSource returns {} for overrides (nothing in the override store),
      // patchOverride returns the new override map. Either way, we just
      // replace state — in source-mode the table-view stays empty.
      setOverrides(result.overrides)
      discardPending(descriptor.flatKey)
      router.refresh()
      // Source-write mode mutates a real file under messages/<locale>/;
      // override mode only mutates the JSON override store. Only the
      // former qualifies as a "source write" — skip the toast in
      // override mode so admins don't get prompted to commit virtual
      // edits that never touch git.
      if (SOURCE_WRITE_ENABLED) notifySourceWrite(notifications, 1, router)
      return result.version
    },
    [locale, discardPending, router, notifications],
  )

  const revertOverride = useCallback(
    async (descriptor: KeyDescriptor) => {
      const remove = SOURCE_WRITE_ENABLED ? deleteSource : deleteOverride
      const { namespace, keyPath } = resolveTarget(descriptor)
      const result = await remove(locale, namespace, keyPath)
      setOverrides(result.overrides)
      discardPending(descriptor.flatKey)
      router.refresh()
      return result.version
    },
    [locale, discardPending, router],
  )

  const publishAll = useCallback(async () => {
    for (const item of Array.from(pending.values())) {
      try {
        await saveEdit({ namespace: item.namespace, keyPath: item.keyPath, flatKey: item.flatKey }, item.draft)
      } catch {
        // continue on individual failures
      }
    }
  }, [pending, saveEdit])

  return { overrides, saveEdit, revertOverride, publishAll }
}
