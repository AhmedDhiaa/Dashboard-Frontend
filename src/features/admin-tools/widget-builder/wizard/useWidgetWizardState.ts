"use client"

/**
 * Draft state for the widget builder. Mirrors entity-builder's
 * useWizardState — sessionStorage-backed partial schema, server-safe
 * defaults, separate `seed` for the edit flow.
 */

import { useCallback, useEffect, useState } from "react"
import type { WidgetBuilderSchema } from "../types/widget-schema"

export type WidgetDraft = Partial<WidgetBuilderSchema>

const STORAGE_KEY = "acme:widget-builder:draft"
const EMPTY: WidgetDraft = {}

function load(): WidgetDraft {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WidgetDraft) : EMPTY
  } catch {
    return EMPTY
  }
}

function persist(draft: WidgetDraft): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // session storage may be full / disabled
  }
}

export function useWidgetWizardState(): {
  draft: WidgetDraft
  patch: (next: WidgetDraft) => void
  reset: () => void
  seed: (next: WidgetDraft) => void
} {
  const [draft, setDraft] = useState<WidgetDraft>(EMPTY)

  useEffect(() => {
    setDraft(load())
  }, [])

  const patch = useCallback((next: WidgetDraft) => {
    setDraft(prev => {
      const merged = { ...prev, ...next }
      persist(merged)
      return merged
    })
  }, [])

  const reset = useCallback(() => {
    setDraft(EMPTY)
    if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  const seed = useCallback((next: WidgetDraft) => {
    setDraft(next)
    persist(next)
  }, [])

  return { draft, patch, reset, seed }
}
