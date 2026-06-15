"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useDebounce } from "@/shared/hooks/useDebounce"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { ensureEntityConfig } from "@/core/entities/registry"
import { searchEntityAutocomplete } from "@/core/crud/services/entity-autocomplete.service"
import {
  SEARCHABLE_ENTITIES,
  MIN_CHARS,
  DEBOUNCE_MS,
  MAX_PER_ENTITY,
  buildSearchTargets,
  resolveItemLabel,
  type SearchTarget,
  type LiveRecordGroup,
} from "./searchable-entities"

export interface LiveSearchResult {
  groups: LiveRecordGroup[]
  loading: boolean
  /** True only when every target request failed (e.g. all endpoints 404). */
  error: boolean
  /** True once the (raw) term is long enough to search. */
  hasTerm: boolean
}

/** Fan out the autocomplete search across targets; one bad endpoint degrades to
 *  an empty group (Promise.allSettled), only a total wipeout reports `error`. */
async function fetchGroups(
  targets: SearchTarget[],
  term: string,
  signal: AbortSignal,
): Promise<{ groups: LiveRecordGroup[]; allFailed: boolean }> {
  const settled = await Promise.allSettled(
    targets.map(async target => {
      const raw = await searchEntityAutocomplete({ entityName: target.entityName, term, signal })
      return {
        target,
        items: raw.slice(0, MAX_PER_ENTITY).map(r => ({
          id: r.id,
          label: resolveItemLabel(r),
          href: `${target.basePath}/${r.id}`,
        })),
      } satisfies LiveRecordGroup
    }),
  )
  const fulfilled = settled
    .filter((s): s is PromiseFulfilledResult<LiveRecordGroup> => s.status === "fulfilled")
    .map(s => s.value)
  return {
    groups: fulfilled.filter(g => g.items.length > 0),
    allFailed: targets.length > 0 && fulfilled.length === 0,
  }
}

/**
 * Debounced, permission-filtered, abortable record search for the command
 * palette. Queries a curated set of entities' `/autocomplete` endpoints by term.
 */
export function useLiveRecordSearch(term: string, enabled: boolean): LiveSearchResult {
  const { isGranted } = usePermissionContext()
  const debounced = useDebounce(term.trim(), DEBOUNCE_MS)

  const [targets, setTargets] = useState<SearchTarget[]>([])
  const [groups, setGroups] = useState<LiveRecordGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const seqRef = useRef(0)
  const cacheRef = useRef(new Map<string, LiveRecordGroup[]>())

  // Permission predicate (admins bypass inside isGranted; key-less = allowed).
  // isGranted is a stable useCallback that changes when grants/admin change.
  const isAllowed = useMemo(() => (key: string | undefined) => !key || isGranted(key), [isGranted])

  // On open: ensure the (small) allowlist configs are loaded, then build targets.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void Promise.all(SEARCHABLE_ENTITIES.map(e => ensureEntityConfig(e.entityName).catch(() => {}))).then(() => {
      if (cancelled) return
      cacheRef.current.clear()
      setTargets(buildSearchTargets(isAllowed))
    })
    return () => {
      cancelled = true
    }
  }, [enabled, isAllowed])

  // Run the debounced search.
  useEffect(() => {
    if (!enabled || debounced.length < MIN_CHARS) {
      setGroups([])
      setLoading(false)
      setError(false)
      return
    }
    const cached = cacheRef.current.get(debounced)
    if (cached) {
      setGroups(cached)
      setLoading(false)
      setError(false)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const seq = ++seqRef.current
    setLoading(true)
    setError(false)
    void fetchGroups(targets, debounced, controller.signal).then(({ groups: next, allFailed }) => {
      if (seq !== seqRef.current) return // a newer keystroke superseded this one
      setGroups(next)
      // Don't cache a total failure — otherwise re-typing the same term hits the
      // cached empty array and shows "no records" instead of retrying/erroring.
      if (!allFailed) cacheRef.current.set(debounced, next)
      setError(allFailed)
      setLoading(false)
    })
    return () => controller.abort()
  }, [debounced, enabled, targets])

  const trimmed = term.trim()
  return {
    groups,
    // Show the loading state during the debounce window too, so the group
    // appears immediately on a >=2-char term rather than popping in after 300ms.
    loading: loading || (trimmed.length >= MIN_CHARS && trimmed !== debounced),
    error,
    hasTerm: trimmed.length >= MIN_CHARS,
  }
}
