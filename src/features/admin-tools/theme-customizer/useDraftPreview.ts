"use client"

/**
 * Mirrors the draft token map onto `document.documentElement.style` so the
 * whole app re-renders with the proposed values in real time. On unmount
 * (or when the draft empties), every set property is cleared so the page
 * snaps back to the SSR-rendered live tokens.
 */

import { useEffect, useRef } from "react"

export function useDraftPreview(draft: Record<string, string>): void {
  const appliedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    const nextKeys = new Set<string>()

    for (const [key, value] of Object.entries(draft)) {
      if (!key.startsWith("--")) continue
      root.style.setProperty(key, value)
      nextKeys.add(key)
    }

    // Clear properties that were set last render but not this one.
    for (const stale of appliedRef.current) {
      if (!nextKeys.has(stale)) root.style.removeProperty(stale)
    }
    appliedRef.current = nextKeys
  }, [draft])

  // On unmount, clear everything we set.
  useEffect(() => {
    return () => {
      if (typeof document === "undefined") return
      const root = document.documentElement
      for (const key of appliedRef.current) root.style.removeProperty(key)
      appliedRef.current = new Set()
    }
  }, [])
}
