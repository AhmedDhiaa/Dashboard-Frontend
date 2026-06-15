"use client"

/**
 * Provider context — exposes the singleton DataProvider to the React tree
 * and gives ergonomic hooks for live config + per-entity data subscriptions.
 *
 * The provider is created lazily on first mount (browser-only) so SSR can
 * still render placeholder UI without crashing.
 */

import { createContext, useContext, useMemo, useRef, useSyncExternalStore } from "react"
import { createLocalStorageProvider } from "./local-storage-provider"
import { createServerProvider } from "./server-provider"
import type { DataProvider, ListParams, RuntimeConfig, RuntimeRecord } from "../types"

const ProviderContext = createContext<DataProvider | null>(null)

/**
 * Backend selection rules:
 *
 *   NEXT_PUBLIC_RUNTIME_BACKEND=server  → call the API routes (shared state).
 *   NEXT_PUBLIC_RUNTIME_BACKEND=local   → keep everything in localStorage.
 *
 * Default is "server" because that matches production reality — every admin
 * looking at the same data. The "local" mode is left in place for offline
 * development, demos, and the one-time migration step.
 */
function buildProvider(): DataProvider {
  const backend = process.env.NEXT_PUBLIC_RUNTIME_BACKEND ?? "server"
  return backend === "local" ? createLocalStorageProvider() : createServerProvider()
}

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  // Single provider per app lifetime
  const providerRef = useRef<DataProvider | null>(null)
  if (providerRef.current === null) {
    providerRef.current = buildProvider()
  }
  return <ProviderContext.Provider value={providerRef.current}>{children}</ProviderContext.Provider>
}

export function useRuntimeProvider(): DataProvider {
  const ctx = useContext(ProviderContext)
  if (!ctx) {
    throw new Error("useRuntimeProvider must be used inside <RuntimeProvider>")
  }
  return ctx
}

/**
 * Subscribe to the full RuntimeConfig — re-renders when any entity, page,
 * or dashboard changes.
 */
export function useRuntimeConfig(): RuntimeConfig {
  const provider = useRuntimeProvider()

  const subscribe = useMemo(() => provider.subscribe.bind(provider), [provider])

  // Cache config snapshot — useSyncExternalStore requires referential equality
  // for unchanged reads, so we memoize by version number.
  const cacheRef = useRef<{ version: number; value: RuntimeConfig } | null>(null)
  const getSnapshot = () => {
    const next = provider.loadConfig()
    const v = next.settings?.version ?? 0
    if (cacheRef.current && cacheRef.current.version === v) {
      return cacheRef.current.value
    }
    cacheRef.current = { version: v, value: next }
    return next
  }
  const getServerSnapshot = () => {
    if (cacheRef.current) return cacheRef.current.value
    const empty: RuntimeConfig = { entities: [], pages: [], dashboards: [], settings: { version: 0 } }
    return empty
  }

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Subscribe to records for a single entity. Re-renders on any storage write.
 *
 * Note: we pass `params` by value, but JSON.stringify would be wasteful here
 * — the snapshot is recomputed only when storage broadcasts a change.
 */
export function useRuntimeList<T extends RuntimeRecord = RuntimeRecord>(
  entityId: string | undefined,
  params?: ListParams,
) {
  const provider = useRuntimeProvider()
  const subscribe = useMemo(() => provider.subscribe.bind(provider), [provider])

  // Stable param reference — caller shouldn't allocate inline objects, but if
  // they do we deep-compare via JSON to avoid effect thrash.
  const paramsKey = JSON.stringify(params ?? {})
  const stableParams = useMemo(() => params, [paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const cacheRef = useRef<{
    key: string
    entityId: string | undefined
    value: { items: T[]; totalCount: number }
  } | null>(null)
  const getSnapshot = () => {
    if (!entityId) {
      const empty = { items: [] as T[], totalCount: 0 }
      cacheRef.current = { key: paramsKey, entityId, value: empty }
      return empty
    }
    // Always re-fetch from storage; cache only re-uses the previous reference
    // when nothing changed (so React skips re-render). Provider broadcast is
    // what drives `subscribe` to re-call this snapshot.
    const next = provider.list<T>(entityId, stableParams)
    if (
      cacheRef.current &&
      cacheRef.current.entityId === entityId &&
      cacheRef.current.key === paramsKey &&
      cacheRef.current.value.totalCount === next.totalCount &&
      cacheRef.current.value.items.length === next.items.length &&
      cacheRef.current.value.items.every((it, i) => it === next.items[i])
    ) {
      return cacheRef.current.value
    }
    cacheRef.current = { key: paramsKey, entityId, value: next }
    return next
  }
  const getServerSnapshot = () => ({ items: [] as T[], totalCount: 0 })

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
