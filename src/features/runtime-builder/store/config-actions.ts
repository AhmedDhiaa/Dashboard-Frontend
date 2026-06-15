/**
 * Config mutation helpers — load, mutate, save in one shot. Keeps every
 * builder UI free of "load → spread → push → save" boilerplate.
 */

import type { DataProvider, RuntimeConfig, RuntimeDashboard, RuntimeEntity, RuntimePage } from "../types"
import { API_ROUTES } from "@/shared/api/routes"

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function withConfig(provider: DataProvider, mutator: (cfg: RuntimeConfig) => RuntimeConfig): void {
  const next = mutator(provider.loadConfig())
  provider.saveConfig(next)
}

// ---------- Entities ----------

export function upsertEntity(provider: DataProvider, entity: RuntimeEntity): void {
  withConfig(provider, cfg => {
    const idx = cfg.entities.findIndex(e => e.id === entity.id)
    const next = idx === -1 ? [...cfg.entities, entity] : cfg.entities.map(e => (e.id === entity.id ? entity : e))
    return { ...cfg, entities: next }
  })
}

export function deleteEntity(provider: DataProvider, entityId: string): void {
  withConfig(provider, cfg => ({
    ...cfg,
    entities: cfg.entities.filter(e => e.id !== entityId),
    // Also drop pages that pointed to this entity, to avoid dangling links
    pages: cfg.pages.filter(p => p.entityId !== entityId),
  }))
  // Wipe the data bucket too — orphaned records are dead weight
  // (DataProvider has no `removeBucket`, so reach into localStorage directly)
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(`acme.runtime.data.${entityId}`)
    } catch {
      /* ignore */
    }
  }
}

// ---------- Pages ----------

export function createPage(provider: DataProvider, page: Omit<RuntimePage, "id" | "order">): RuntimePage {
  const cfg = provider.loadConfig()
  const order = cfg.pages.length === 0 ? 0 : Math.max(...cfg.pages.map(p => p.order)) + 1
  const next: RuntimePage = { ...page, id: genId("pg"), order }
  provider.saveConfig({ ...cfg, pages: [...cfg.pages, next] })
  return next
}

export function updatePage(provider: DataProvider, pageId: string, patch: Partial<RuntimePage>): void {
  withConfig(provider, cfg => ({
    ...cfg,
    pages: cfg.pages.map(p => (p.id === pageId ? { ...p, ...patch, id: p.id } : p)),
  }))
}

export function deletePage(provider: DataProvider, pageId: string): void {
  withConfig(provider, cfg => ({ ...cfg, pages: cfg.pages.filter(p => p.id !== pageId) }))
}

export function reorderPages(provider: DataProvider, orderedIds: string[]): void {
  withConfig(provider, cfg => {
    const map = new Map(cfg.pages.map(p => [p.id, p]))
    const reordered: RuntimePage[] = []
    orderedIds.forEach((id, i) => {
      const p = map.get(id)
      if (p) {
        reordered.push({ ...p, order: i })
        map.delete(id)
      }
    })
    // Append any pages not in the orderedIds list (defensive)
    map.forEach(p => reordered.push(p))
    return { ...cfg, pages: reordered }
  })
}

// ---------- Dashboards ----------

export function upsertDashboard(provider: DataProvider, dashboard: RuntimeDashboard): void {
  withConfig(provider, cfg => {
    const idx = cfg.dashboards.findIndex(d => d.id === dashboard.id)
    const next =
      idx === -1 ? [...cfg.dashboards, dashboard] : cfg.dashboards.map(d => (d.id === dashboard.id ? dashboard : d))
    return { ...cfg, dashboards: next }
  })
}

export function deleteDashboard(provider: DataProvider, dashboardId: string): void {
  withConfig(provider, cfg => ({
    ...cfg,
    dashboards: cfg.dashboards.filter(d => d.id !== dashboardId),
    pages: cfg.pages.filter(p => p.dashboardId !== dashboardId),
  }))
}

// ---------- Import / Export ----------

export function exportConfig(provider: DataProvider): string {
  // Bundle config + every entity's data so import fully restores the app
  const cfg = provider.loadConfig()
  const data: Record<string, unknown> = {}
  if (typeof window !== "undefined") {
    cfg.entities.forEach(e => {
      try {
        const raw = window.localStorage.getItem(`acme.runtime.data.${e.id}`)
        if (raw) data[e.id] = JSON.parse(raw)
      } catch {
        /* ignore */
      }
    })
  }
  return JSON.stringify({ config: cfg, data, exportedAt: Date.now() }, null, 2)
}

export function importConfig(provider: DataProvider, json: string): void {
  const parsed = JSON.parse(json) as { config?: RuntimeConfig; data?: Record<string, unknown> }
  if (!parsed.config) throw new Error("Invalid runtime config: missing 'config' field")
  provider.saveConfig(parsed.config)
  if (parsed.data && typeof window !== "undefined") {
    for (const [entityId, items] of Object.entries(parsed.data)) {
      try {
        window.localStorage.setItem(`acme.runtime.data.${entityId}`, JSON.stringify(items))
      } catch {
        /* ignore quota */
      }
    }
    // Notify subscribers of data buckets
    window.dispatchEvent(new CustomEvent("acme-runtime-change"))
  }
}

export { genId }

// ---------- Local → Server migration ----------

export interface MigrationReport {
  configPushed: boolean
  entityCount: number
  recordCount: number
  errors: string[]
}

const CONFIG_KEY = "acme.runtime.config"
const DATA_PREFIX = "acme.runtime.data."

interface DataKey {
  entityId: string
  storageKey: string
}

function listLocalDataKeys(): DataKey[] {
  const out: DataKey[] = []
  if (typeof window === "undefined") return out
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k || !k.startsWith(DATA_PREFIX)) continue
    out.push({ entityId: k.slice(DATA_PREFIX.length), storageKey: k })
  }
  return out
}

async function pushLocalConfig(report: MigrationReport): Promise<{ aborted: boolean }> {
  const configRaw = window.localStorage.getItem(CONFIG_KEY)
  if (!configRaw) return { aborted: false }
  let parsed: RuntimeConfig
  try {
    parsed = JSON.parse(configRaw) as RuntimeConfig
  } catch (err) {
    report.errors.push(`Failed to parse local config: ${err instanceof Error ? err.message : String(err)}`)
    return { aborted: true }
  }
  const { settings: _settings, ...rest } = parsed
  const res = await fetch(API_ROUTES.runtime.config, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rest),
  }).catch(err => {
    report.errors.push(`PUT /config threw: ${err instanceof Error ? err.message : String(err)}`)
    return null
  })
  if (!res) return { aborted: true }
  if (!res.ok) {
    report.errors.push(`PUT /config failed (HTTP ${res.status}) — aborting before record push`)
    return { aborted: true }
  }
  report.configPushed = true
  report.entityCount = parsed.entities?.length ?? 0
  return { aborted: false }
}

function readLocalBucket(storageKey: string, report: MigrationReport): Record<string, unknown>[] | null {
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : null
  } catch (err) {
    report.errors.push(`Failed to parse ${storageKey}: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function pushOneRecord(entityId: string, item: Record<string, unknown>, report: MigrationReport): Promise<void> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...payload } = item
  try {
    const res = await fetch(API_ROUTES.runtime.data(encodeURIComponent(entityId)), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) report.recordCount += 1
    else report.errors.push(`POST /data/${entityId} failed (HTTP ${res.status})`)
  } catch (err) {
    report.errors.push(`POST /data/${entityId} threw: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * One-time migration: take everything currently sitting in this browser's
 * localStorage and push it to the server, then clear localStorage so the
 * browser stops looking at its private copy.
 *
 * Idempotent — re-running on an empty localStorage is a no-op. Partial
 * failures leave localStorage untouched so the user can retry; success
 * clears localStorage and broadcasts so the active provider re-polls.
 */
export async function migrateLocalToServer(): Promise<MigrationReport> {
  const report: MigrationReport = { configPushed: false, entityCount: 0, recordCount: 0, errors: [] }

  if (typeof window === "undefined") {
    report.errors.push("Migration must run in the browser")
    return report
  }

  const { aborted } = await pushLocalConfig(report)
  if (aborted) return report

  const dataKeys = listLocalDataKeys()
  for (const { entityId, storageKey } of dataKeys) {
    const items = readLocalBucket(storageKey, report)
    if (!items) continue
    for (const item of items) await pushOneRecord(entityId, item, report)
  }

  if (report.errors.length === 0) {
    window.localStorage.removeItem(CONFIG_KEY)
    dataKeys.forEach(({ storageKey }) => window.localStorage.removeItem(storageKey))
    window.dispatchEvent(new CustomEvent("acme-runtime-change"))
  }

  return report
}
