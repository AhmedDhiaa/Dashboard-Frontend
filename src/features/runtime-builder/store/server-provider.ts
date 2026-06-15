/**
 * Server-backed DataProvider.
 *
 * Design notes:
 *
 *  - The DataProvider interface is synchronous, but HTTP isn't. So this
 *    provider keeps an in-memory cache of config + per-entity record buckets
 *    and serves reads from cache. Writes are optimistic: we update the
 *    cache immediately, broadcast to subscribers, and fire the API call in
 *    the background. On API error we roll back and notify again so the UI
 *    re-renders with the correct state.
 *
 *  - Cross-tab / multi-admin sync rides SignalR. The backend broadcasts
 *    `ReceiveRuntimeConfigChanged` ({ version }) to every authenticated
 *    socket whenever any admin mutates config. On receive we refetch the
 *    config and invalidate per-entity buckets (which lazy-refetch on
 *    next `list()`). One mount-time `/api/runtime/version` fetch
 *    establishes the baseline and catches changes that happened between
 *    SSR and SignalR connect; after that there is no polling.
 *
 *  - Record IDs are server-assigned. For optimistic create() we mint a
 *    temporary id; once the POST resolves we swap it for the canonical
 *    record returned by the server. Callers that rely on the create()
 *    return value being the final id must be aware of this — the existing
 *    EntityDataView only uses it to close the dialog, so this is fine.
 */

import type { DataProvider, ListParams, ListResult, RuntimeConfig, RuntimeRecord } from "../types"
import { socket } from "@/infra/socket/socket"
import { API_ROUTES } from "@/shared/api/routes"

// Backend contract: emitted by every connection on any admin's mutate. See
// the file header for the contract spec.
const RUNTIME_CONFIG_EVENT = "ReceiveRuntimeConfigChanged"

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMPTY_CONFIG: RuntimeConfig = {
  entities: [],
  pages: [],
  dashboards: [],
  settings: { version: 0 },
}

function tmpId(prefix: string): string {
  return `tmp_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

function applyListParams<T extends RuntimeRecord>(items: T[], params: ListParams = {}): ListResult<T> {
  let filtered = items
  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(item =>
      Object.values(item).some(v => typeof v === "string" && v.toLowerCase().includes(q)),
    )
  }
  if (params.sortBy) {
    const dir = params.sortDir === "desc" ? -1 : 1
    const key = params.sortBy
    filtered = [...filtered].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }
  const totalCount = filtered.length
  if (params.pageSize) {
    const page = Math.max(1, params.page ?? 1)
    const start = (page - 1) * params.pageSize
    filtered = filtered.slice(start, start + params.pageSize)
  }
  return { items: filtered, totalCount }
}

// ─── Provider factory ───────────────────────────────────────────────────────

// eslint-disable-next-line max-lines-per-function -- Closure-based provider; every method needs the caches in scope
export function createServerProvider(): DataProvider {
  // ── In-memory state ──────────────────────────────────────────────────────
  let configCache: RuntimeConfig = EMPTY_CONFIG
  // null = never fetched yet; an explicit empty array means "fetched, was empty"
  const recordsCache = new Map<string, RuntimeRecord[]>()
  const inFlightListFetch = new Map<string, Promise<void>>()
  let serverVersion = 0
  let syntheticVersion = 0
  let initialConfigFetched = false
  let configInFlight: Promise<void> | null = null

  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(l => l())

  // Bump the user-visible version so useRuntimeConfig invalidates its memoized snapshot.
  function bumpAndNotify() {
    syntheticVersion += 1
    configCache = { ...configCache, settings: { ...configCache.settings, version: syntheticVersion } }
    notify()
  }

  // ── Background tasks ─────────────────────────────────────────────────────

  async function fetchConfig(): Promise<void> {
    if (configInFlight) return configInFlight
    configInFlight = (async () => {
      try {
        const res = await fetch(API_ROUTES.runtime.config, { cache: "no-store" })
        if (!res.ok) return
        const next = (await res.json()) as RuntimeConfig
        configCache = {
          entities: next.entities ?? [],
          pages: next.pages ?? [],
          dashboards: next.dashboards ?? [],
          settings: { version: ++syntheticVersion },
        }
        initialConfigFetched = true
        notify()
      } catch {
        // Keep the previous (or empty) cache; subscribers stay subscribed
        // and the next poll cycle will retry.
      } finally {
        configInFlight = null
      }
    })()
    return configInFlight
  }

  async function fetchList(entityId: string): Promise<void> {
    const existing = inFlightListFetch.get(entityId)
    if (existing) return existing
    const p = (async () => {
      try {
        const res = await fetch(API_ROUTES.runtime.data(encodeURIComponent(entityId)), { cache: "no-store" })
        if (!res.ok) {
          // Treat 4xx/5xx as "no records" so the UI shows an empty state
          // rather than an infinite spinner. Errors are logged to console.
          if (!recordsCache.has(entityId)) recordsCache.set(entityId, [])
          return
        }
        const body = (await res.json()) as { items?: RuntimeRecord[] }
        recordsCache.set(entityId, body.items ?? [])
        bumpAndNotify()
      } catch {
        if (!recordsCache.has(entityId)) recordsCache.set(entityId, [])
      } finally {
        inFlightListFetch.delete(entityId)
      }
    })()
    inFlightListFetch.set(entityId, p)
    return p
  }

  // One-shot baseline check: catches any version drift that happened
  // between SSR and the moment SignalR finishes its handshake. After
  // this, all updates ride the push channel — no polling.
  async function syncFromServer(): Promise<void> {
    try {
      const res = await fetch(API_ROUTES.runtime.version, { cache: "no-store" })
      if (!res.ok) return
      const body = (await res.json()) as { version?: number }
      const remote = body.version ?? 0
      if (remote !== serverVersion) {
        serverVersion = remote
        recordsCache.clear()
        await fetchConfig()
        notify()
      }
    } catch {
      // Network blip on baseline — push will catch the next mutation.
    }
  }

  // Kick off the initial fetch + subscribe to push updates. SSR-safe: in
  // Node there's no `window.fetch`, but Next.js polyfills global `fetch`
  // on the server, and we only construct the provider inside a "use
  // client" component.
  if (typeof window !== "undefined") {
    void fetchConfig()
    void syncFromServer()
    // SignalR subscriptions are accepted before the socket finishes
    // connecting; the dispatcher buffers them and re-registers after
    // the SocketProvider establishes the connection. Singleton lifetime
    // matches the app, so we don't bother with explicit cleanup.
    socket.on<{ version?: number }>(RUNTIME_CONFIG_EVENT, payload => {
      const remote = payload?.version ?? 0
      if (!remote || remote === serverVersion) return
      serverVersion = remote
      recordsCache.clear()
      void fetchConfig()
    })
  }

  // ── Mutation helpers (optimistic + rollback) ─────────────────────────────

  async function pushConfig(snapshot: RuntimeConfig): Promise<boolean> {
    try {
      // Strip the synthetic version field before sending — the server
      // assigns its own version counter independently.
      const { settings: _, ...rest } = snapshot
      const res = await fetch(API_ROUTES.runtime.config, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // ── DataProvider methods ─────────────────────────────────────────────────

  function loadConfig(): RuntimeConfig {
    // First read kicks off the fetch; we still return the empty cache
    // synchronously so the UI can render its skeleton.
    if (!initialConfigFetched && !configInFlight) void fetchConfig()
    return configCache
  }

  function saveConfig(config: RuntimeConfig): void {
    const previous = configCache
    configCache = { ...config, settings: { version: ++syntheticVersion } }
    notify()
    void (async () => {
      const ok = await pushConfig(configCache)
      if (!ok) {
        configCache = previous
        bumpAndNotify()
      }
    })()
  }

  function resetConfig(): void {
    saveConfig(EMPTY_CONFIG)
    // Also wipe per-entity buckets; the server owns the actual files but
    // clearing the cache prevents stale UI between the PUT and the next poll.
    recordsCache.clear()
    notify()
  }

  function list<T extends RuntimeRecord = RuntimeRecord>(entityId: string, params?: ListParams): ListResult<T> {
    const cached = recordsCache.get(entityId)
    if (cached === undefined) {
      void fetchList(entityId)
      return { items: [], totalCount: 0 }
    }
    return applyListParams(cached as T[], params)
  }

  function get<T extends RuntimeRecord = RuntimeRecord>(entityId: string, id: string): T | undefined {
    const cached = recordsCache.get(entityId)
    if (cached === undefined) {
      void fetchList(entityId)
      return undefined
    }
    return cached.find(r => r.id === id) as T | undefined
  }

  function create<T extends RuntimeRecord = RuntimeRecord>(entityId: string, data: Partial<T>): T {
    const now = Date.now()
    const optimistic = { ...data, id: tmpId(entityId), createdAt: now, updatedAt: now } as T

    const previous = recordsCache.get(entityId) ?? []
    recordsCache.set(entityId, [...previous, optimistic])
    bumpAndNotify()

    void (async () => {
      try {
        const res = await fetch(API_ROUTES.runtime.data(encodeURIComponent(entityId)), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await safeJson<{ record?: RuntimeRecord }>(res, {})
        const current = recordsCache.get(entityId) ?? []
        // Replace the optimistic placeholder with the canonical server record.
        const reconciled = body.record ? current.map(r => (r.id === optimistic.id ? body.record! : r)) : current
        recordsCache.set(entityId, reconciled)
        bumpAndNotify()
      } catch {
        // Roll back the optimistic insert.
        const current = recordsCache.get(entityId) ?? []
        recordsCache.set(
          entityId,
          current.filter(r => r.id !== optimistic.id),
        )
        bumpAndNotify()
      }
    })()

    return optimistic
  }

  function update<T extends RuntimeRecord = RuntimeRecord>(entityId: string, id: string, data: Partial<T>): T {
    const previous = recordsCache.get(entityId) ?? []
    const idx = previous.findIndex(r => r.id === id)
    if (idx === -1) {
      throw new Error(`[runtime/server] Record "${id}" not found in entity "${entityId}"`)
    }
    const existing = previous[idx]!
    const optimistic = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    } as T

    recordsCache.set(
      entityId,
      previous.map(r => (r.id === id ? optimistic : r)),
    )
    bumpAndNotify()

    void (async () => {
      try {
        const res = await fetch(API_ROUTES.runtime.data(encodeURIComponent(entityId)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...data }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await safeJson<{ record?: RuntimeRecord }>(res, {})
        if (body.record) {
          const current = recordsCache.get(entityId) ?? []
          recordsCache.set(
            entityId,
            current.map(r => (r.id === id ? body.record! : r)),
          )
          bumpAndNotify()
        }
      } catch {
        recordsCache.set(entityId, previous)
        bumpAndNotify()
      }
    })()

    return optimistic
  }

  function remove(entityId: string, id: string): void {
    const previous = recordsCache.get(entityId) ?? []
    recordsCache.set(
      entityId,
      previous.filter(r => r.id !== id),
    )
    bumpAndNotify()

    void (async () => {
      try {
        const res = await fetch(API_ROUTES.runtime.data(encodeURIComponent(entityId)), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch {
        recordsCache.set(entityId, previous)
        bumpAndNotify()
      }
    })()
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    loadConfig,
    saveConfig,
    resetConfig,
    list,
    get,
    create,
    update,
    remove,
    subscribe,
  }
}
