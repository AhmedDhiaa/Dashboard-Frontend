"use client"

/**
 * Owns the (namespace, key) ↔ rendered-text indices and registers the global
 * `useT()` tap so every translation call is recorded while edit mode is on.
 *
 * Returns refs (not snapshots) — consumers re-read from them on each render
 * driven by the `version` counter, which bumps once per microtask whenever
 * the index actually mutates. This avoids re-rendering the entire app on
 * every translation call (there are thousands per page).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { setTranslationTap } from "@/shared/config"
import type { TranslationCallRecord } from "../types"

function buildFlatKey(namespace: string | undefined, key: string): string {
  return namespace ? `${namespace}.${key}` : key
}

export interface IndicesHandle {
  callIndex: Map<string, TranslationCallRecord>
  textIndex: Map<string, Set<string>>
  version: number
}

export function useTranslationIndices(enabled: boolean): IndicesHandle {
  const callIndexRef = useRef<Map<string, TranslationCallRecord>>(new Map())
  const textIndexRef = useRef<Map<string, Set<string>>>(new Map())
  const [version, setVersion] = useState(0)
  const bumpScheduled = useRef(false)

  const scheduleBump = useCallback(() => {
    if (bumpScheduled.current) return
    bumpScheduled.current = true
    queueMicrotask(() => {
      bumpScheduled.current = false
      setVersion(v => v + 1)
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      setTranslationTap(null)
      callIndexRef.current.clear()
      textIndexRef.current.clear()
      return
    }

    setTranslationTap((namespace, key, rendered) => {
      const flatKey = buildFlatKey(namespace, key)
      const existing = callIndexRef.current.get(flatKey)
      if (existing && existing.rendered === rendered) return
      callIndexRef.current.set(flatKey, { namespace: namespace ?? "", keyPath: key, flatKey, rendered })
      let bucket = textIndexRef.current.get(rendered)
      if (!bucket) {
        bucket = new Set()
        textIndexRef.current.set(rendered, bucket)
      }
      bucket.add(flatKey)
      scheduleBump()
    })

    return () => setTranslationTap(null)
  }, [enabled, scheduleBump])

  return { callIndex: callIndexRef.current, textIndex: textIndexRef.current, version }
}
