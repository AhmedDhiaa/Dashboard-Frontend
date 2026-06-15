"use client"

/**
 * Owns the live/draft/version state and the mutation handlers
 * (setToken, clearToken, applyPreset, saveDraft, publish, revert, reset).
 * Returned as a single object so the page composition stays under the
 * per-function line cap.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchStage, publishDraft, revertDraft, saveDraft } from "./api"
import { defaultValueFor } from "./token-catalog"

export interface CustomizerState {
  live: Record<string, string>
  draft: Record<string, string>
  version: number
  busy: boolean
  status: string | null
  dirtyCount: number
  setToken: (key: string, value: string) => void
  clearToken: (key: string) => void
  /**
   * Reset a single token to its built-in default. If the default equals the
   * published live value, the draft override is simply dropped; otherwise the
   * draft is pinned to the default so the control visibly returns to baseline
   * even when live carries an override.
   */
  resetToken: (key: string) => void
  applyPreset: (tokens: Record<string, string>) => void
  /** Replace the whole draft map (e.g. Import JSON, Reset to defaults). */
  replaceDraft: (tokens: Record<string, string>) => void
  /** Shallow-merge tokens into the draft (e.g. Import JSON → merge). */
  mergeDraft: (tokens: Record<string, string>) => void
  /** Persist the current draft without publishing it. */
  handleSaveDraft: () => Promise<void>
  handlePublish: () => Promise<void>
  handleRevert: () => Promise<void>
  /** Clear ALL draft tokens and persist the empty draft (fall back to defaults). */
  handleResetToDefaults: () => Promise<void>
}

export function useCustomizerState(canEdit: boolean): CustomizerState {
  const [live, setLive] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const liveStage = await fetchStage("live")
    setLive(liveStage.tokens)
    setVersion(liveStage.version)
    try {
      const draftStage = await fetchStage("draft")
      setDraft(draftStage.tokens)
    } catch {
      setDraft({})
    }
  }, [])

  useEffect(() => {
    if (canEdit) void reload()
  }, [canEdit, reload])

  const setToken = useCallback((key: string, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearToken = useCallback((key: string) => {
    setDraft(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const resetToken = useCallback(
    (key: string) => {
      const def = defaultValueFor(key)
      const liveValue = live[key]
      setDraft(prev => {
        const next = { ...prev }
        // Live already sits at (or near) the default → just drop the override.
        if (liveValue === undefined || liveValue === def) {
          delete next[key]
        } else {
          // Live carries an override → pin the draft to the default so the
          // control returns to baseline (publishing writes default explicitly).
          next[key] = def
        }
        return next
      })
    },
    [live],
  )

  const applyPreset = useCallback((tokens: Record<string, string>) => {
    setDraft(prev => ({ ...prev, ...tokens }))
    setStatus("Preset applied to draft. Click Publish to make it live.")
  }, [])

  const replaceDraft = useCallback((tokens: Record<string, string>) => {
    setDraft({ ...tokens })
  }, [])

  const mergeDraft = useCallback((tokens: Record<string, string>) => {
    setDraft(prev => ({ ...prev, ...tokens }))
  }, [])

  const { handleSaveDraft, handlePublish, handleRevert, handleResetToDefaults } = usePersistenceHandlers({
    draft,
    reload,
    setBusy,
    setStatus,
    setLive,
    setVersion,
    setDraft,
  })

  const dirtyCount = useMemo(() => {
    const keys = new Set([...Object.keys(draft), ...Object.keys(live)])
    let count = 0
    for (const k of keys) {
      if ((draft[k] ?? "") !== (live[k] ?? "")) count += 1
    }
    return count
  }, [draft, live])

  return {
    live,
    draft,
    version,
    busy,
    status,
    dirtyCount,
    setToken,
    clearToken,
    resetToken,
    applyPreset,
    replaceDraft,
    mergeDraft,
    handleSaveDraft,
    handlePublish,
    handleRevert,
    handleResetToDefaults,
  }
}

interface PersistenceDeps {
  draft: Record<string, string>
  reload: () => Promise<void>
  setBusy: (v: boolean) => void
  setStatus: (v: string | null) => void
  setLive: (v: Record<string, string>) => void
  setVersion: (v: number) => void
  setDraft: (v: Record<string, string>) => void
}

/**
 * The four async persistence handlers, split out of the main hook so its body
 * stays within the per-function line cap. Each wraps its API call in a
 * busy/status envelope.
 */
function usePersistenceHandlers(deps: PersistenceDeps) {
  const { draft, reload, setBusy, setStatus, setLive, setVersion, setDraft } = deps

  const run = useCallback(
    async (work: () => Promise<string>, fallback: string) => {
      setBusy(true)
      setStatus(null)
      try {
        setStatus(await work())
      } catch (err) {
        setStatus(err instanceof Error ? err.message : fallback)
      } finally {
        setBusy(false)
      }
    },
    [setBusy, setStatus],
  )

  const handleSaveDraft = useCallback(
    () =>
      run(async () => {
        await saveDraft(draft)
        return "Draft saved. It is not live yet — click Publish when ready."
      }, "Save draft failed"),
    [run, draft],
  )

  const handlePublish = useCallback(
    () =>
      run(async () => {
        await saveDraft(draft)
        const result = await publishDraft()
        setLive(result.tokens)
        setVersion(result.version)
        return `Published. New version: ${result.version}`
      }, "Publish failed"),
    [run, draft, setLive, setVersion],
  )

  const handleRevert = useCallback(
    () =>
      run(async () => {
        await revertDraft()
        await reload()
        return "Reverted. Local preview reset to live."
      }, "Revert failed"),
    [run, reload],
  )

  const handleResetToDefaults = useCallback(
    () =>
      run(async () => {
        setDraft({})
        await saveDraft({})
        return "All overrides cleared from draft. Publish to fall back to built-in defaults."
      }, "Reset failed"),
    [run, setDraft],
  )

  return { handleSaveDraft, handlePublish, handleRevert, handleResetToDefaults }
}
