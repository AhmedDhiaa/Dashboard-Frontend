"use client"

/**
 * The provider stitches together two hooks:
 *   - useTranslationIndices: tap into useT() and build the (key ↔ text) maps
 *   - useOverrideMutations:  PATCH/DELETE/publish + router.refresh wiring
 * plus its own thin state for the toggle, the open panel, and the pending tray.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLocale } from "next-intl"
import type { KeyDescriptor, PendingEdit, TranslationEditorContextValue } from "./types"
import { useTranslationIndices } from "./hooks/useTranslationIndices"
import { useOverrideMutations } from "./hooks/useOverrideMutations"

const TranslationEditorContext = createContext<TranslationEditorContextValue | null>(null)
const STORAGE_KEY = "acme:translation-editor:enabled"

export function TranslationEditorProvider({ children }: { children: React.ReactNode }) {
  const localeRaw = useLocale()
  const locale: "en" | "ar" = localeRaw === "ar" ? "ar" : "en"

  const [enabled, setEnabled] = useState(false)
  const [activeKey, setActiveKey] = useState<KeyDescriptor | null>(null)
  const [pending, setPending] = useState<Map<string, PendingEdit>>(() => new Map())

  // Hydrate the toggle from sessionStorage so a refresh doesn't drop edit mode.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setEnabled(true)
  }, [])

  const indices = useTranslationIndices(enabled)

  const discardPending = useCallback((flatKey: string) => {
    setPending(prev => {
      if (!prev.has(flatKey)) return prev
      const next = new Map(prev)
      next.delete(flatKey)
      return next
    })
  }, [])

  const mutations = useOverrideMutations({ enabled, locale, pending, discardPending })

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev
      if (typeof window !== "undefined") {
        if (next) sessionStorage.setItem(STORAGE_KEY, "1")
        else sessionStorage.removeItem(STORAGE_KEY)
      }
      return next
    })
  }, [])

  const setPendingEdit = useCallback((descriptor: KeyDescriptor, draft: string, baseline: string) => {
    setPending(prev => {
      const next = new Map(prev)
      next.set(descriptor.flatKey, { ...descriptor, draft, baseline })
      return next
    })
  }, [])

  const value = useMemo<TranslationEditorContextValue>(
    () => ({
      enabled,
      toggle,
      edit: setActiveKey,
      activeKey,
      closePanel: () => setActiveKey(null),
      callIndex: indices.callIndex,
      textIndex: indices.textIndex,
      pending,
      setPending: setPendingEdit,
      discardPending,
      saveEdit: mutations.saveEdit,
      revertOverride: mutations.revertOverride,
      publishAll: mutations.publishAll,
      overrides: mutations.overrides,
      locale,
    }),
    // indices.version forces re-publish when the maps mutate (the maps
    // themselves are stable refs, so React wouldn't otherwise notice).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      enabled,
      toggle,
      activeKey,
      pending,
      setPendingEdit,
      discardPending,
      mutations,
      indices.callIndex,
      indices.textIndex,
      indices.version,
      locale,
    ],
  )

  return <TranslationEditorContext.Provider value={value}>{children}</TranslationEditorContext.Provider>
}

export function useTranslationEditor(): TranslationEditorContextValue {
  const ctx = useContext(TranslationEditorContext)
  if (!ctx) throw new Error("useTranslationEditor must be used within <TranslationEditorProvider>")
  return ctx
}
