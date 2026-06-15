/**
 * LocalStorage adapter for the runtime DataProvider.
 *
 * Layout:
 *   acme.runtime.config              → RuntimeConfig (entities, pages, dashboards, settings)
 *   acme.runtime.data.<entityId>     → RuntimeRecord[]
 *
 * SSR-safe: every method guards on `typeof window` so this can be imported
 * from server components without crashing — calls return empty defaults.
 */

import type { DataProvider, ListParams, ListResult, RuntimeConfig, RuntimeRecord } from "../types"

const CONFIG_KEY = "acme.runtime.config"
const DATA_PREFIX = "acme.runtime.data."
const BROADCAST_EVENT = "acme-runtime-change"

const EMPTY_CONFIG: RuntimeConfig = {
  entities: [],
  pages: [],
  dashboards: [],
  settings: { version: 1 },
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function safeRead<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function safeWrite(key: string, value: unknown): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled — silently drop. Builder UI will
    // still work in-memory until next page load.
  }
}

function broadcast(): void {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(BROADCAST_EVENT))
}

function genId(prefix = "rec"): string {
  // Short, sortable, collision-resistant enough for in-browser use
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// eslint-disable-next-line max-lines-per-function -- Closure-based provider: every method needs the listener Set in scope
export function createLocalStorageProvider(): DataProvider {
  const listeners = new Set<() => void>()

  function notify(): void {
    listeners.forEach(l => l())
  }

  // Cross-tab + same-tab sync: re-notify on the broadcast event
  if (isBrowser()) {
    window.addEventListener(BROADCAST_EVENT, notify)
    window.addEventListener("storage", e => {
      if (e.key === CONFIG_KEY || (e.key && e.key.startsWith(DATA_PREFIX))) notify()
    })
  }

  function loadConfig(): RuntimeConfig {
    const stored = safeRead<RuntimeConfig | null>(CONFIG_KEY, null)
    if (!stored) return { ...EMPTY_CONFIG, settings: { version: 1 } }
    return {
      entities: stored.entities ?? [],
      pages: stored.pages ?? [],
      dashboards: stored.dashboards ?? [],
      settings: stored.settings ?? { version: 1 },
    }
  }

  function saveConfig(config: RuntimeConfig): void {
    const next: RuntimeConfig = {
      ...config,
      settings: { version: (config.settings?.version ?? 0) + 1 },
    }
    safeWrite(CONFIG_KEY, next)
    broadcast()
  }

  function resetConfig(): void {
    if (!isBrowser()) return
    // Wipe config and every per-entity data bucket
    const keysToDelete: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!k) continue
      if (k === CONFIG_KEY || k.startsWith(DATA_PREFIX)) keysToDelete.push(k)
    }
    keysToDelete.forEach(k => window.localStorage.removeItem(k))
    broadcast()
  }

  function readBucket<T extends RuntimeRecord>(entityId: string): T[] {
    return safeRead<T[]>(`${DATA_PREFIX}${entityId}`, [])
  }

  function writeBucket<T extends RuntimeRecord>(entityId: string, items: T[]): void {
    safeWrite(`${DATA_PREFIX}${entityId}`, items)
    broadcast()
  }

  function list<T extends RuntimeRecord = RuntimeRecord>(entityId: string, params: ListParams = {}): ListResult<T> {
    let items = readBucket<T>(entityId)

    if (params.search) {
      const q = params.search.toLowerCase()
      items = items.filter(item => Object.values(item).some(v => typeof v === "string" && v.toLowerCase().includes(q)))
    }

    if (params.sortBy) {
      const dir = params.sortDir === "desc" ? -1 : 1
      const key = params.sortBy
      items = [...items].sort((a, b) => {
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

    const totalCount = items.length

    if (params.pageSize) {
      const page = Math.max(1, params.page ?? 1)
      const start = (page - 1) * params.pageSize
      items = items.slice(start, start + params.pageSize)
    }

    return { items, totalCount }
  }

  function get<T extends RuntimeRecord = RuntimeRecord>(entityId: string, id: string): T | undefined {
    return readBucket<T>(entityId).find(r => r.id === id)
  }

  function create<T extends RuntimeRecord = RuntimeRecord>(entityId: string, data: Partial<T>): T {
    const now = Date.now()
    const record = {
      ...data,
      id: genId(entityId),
      createdAt: now,
      updatedAt: now,
    } as T
    const items = readBucket<T>(entityId)
    items.push(record)
    writeBucket(entityId, items)
    return record
  }

  function update<T extends RuntimeRecord = RuntimeRecord>(entityId: string, id: string, data: Partial<T>): T {
    const items = readBucket<T>(entityId)
    const idx = items.findIndex(r => r.id === id)
    if (idx === -1) {
      throw new Error(`[runtime] Record "${id}" not found in entity "${entityId}"`)
    }
    const existing = items[idx]
    if (!existing) throw new Error(`[runtime] Record "${id}" missing after index lookup`)
    const next = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    } as T
    items[idx] = next
    writeBucket(entityId, items)
    return next
  }

  function remove(entityId: string, id: string): void {
    const items = readBucket(entityId).filter(r => r.id !== id)
    writeBucket(entityId, items)
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
