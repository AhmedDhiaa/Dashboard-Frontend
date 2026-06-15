/**
 * Command-palette live record search — searchable entity set + pure helpers.
 *
 * A small curated allowlist (entityName + display priority) of entities that
 * have BOTH a verified `/api/app/{entity}/autocomplete` endpoint AND an
 * `[id]` detail route. Everything ELSE (label, route, permission key, icon)
 * is read LIVE from the entity registry so the admin `_overrides` layer is
 * honored and labels never drift from `config.translations.listTitle`.
 */
import type { LucideIcon } from "lucide-react"
import { getEntityConfig, hasEntityConfig } from "@/core/entities/registry"
import type { RawEntityItem } from "@/core/crud/services/entity-autocomplete.service"

export interface SearchableEntity {
  entityName: string
  /** Lower = searched/shown first. */
  priority: number
}

/** Curated, priority-ordered. Each has a confirmed autocomplete endpoint + detail route. */
export const SEARCHABLE_ENTITIES: readonly SearchableEntity[] = [
  { entityName: "order", priority: 0 },
  { entityName: "business-partner", priority: 1 },
  { entityName: "item", priority: 2 },
  { entityName: "vehicle", priority: 3 },
  { entityName: "employee", priority: 4 },
  { entityName: "warehouse", priority: 5 },
  { entityName: "sales-invoice", priority: 6 },
  { entityName: "purchase-invoice", priority: 7 },
  { entityName: "payment", priority: 8 },
  { entityName: "receive", priority: 9 },
  { entityName: "ticket", priority: 10 },
] as const

export const MIN_CHARS = 2
export const DEBOUNCE_MS = 300
export const MAX_PER_ENTITY = 5
/** Priority head — hard cap on requests fired per debounced term. */
export const MAX_ACTIVE_TARGETS = 8

export interface SearchTarget {
  entityName: string
  basePath: string
  titleKey: string
  icon: LucideIcon
  priority: number
}

export interface LiveRecordItem {
  id: string | number
  label: string
  href: string
}

export interface LiveRecordGroup {
  target: SearchTarget
  items: LiveRecordItem[]
}

/**
 * Resolve a human label for an autocomplete row. Covers entities that have no
 * `name` (orders/payments use `documentRef`, vehicles use `vehicleNumber`),
 * falling back to the id so a row is never blank.
 */
export function resolveItemLabel(raw: RawEntityItem): string {
  const r = raw as Record<string, unknown>
  for (const key of ["name", "documentRef", "reference", "vehicleNumber", "userName", "fullName", "title", "code"]) {
    const v = r[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return String(raw.id)
}

/**
 * Build the permission-filtered, priority-capped search targets from the
 * registry. `isAllowed(permissionKey)` decides view eligibility (admins bypass
 * via the caller's isGranted). Configs must already be loaded (the palette
 * preloads them on open).
 */
export function buildSearchTargets(isAllowed: (permissionKey: string | undefined) => boolean): SearchTarget[] {
  const targets: SearchTarget[] = []
  for (const { entityName, priority } of SEARCHABLE_ENTITIES) {
    if (!hasEntityConfig(entityName)) continue
    const cfg = getEntityConfig(entityName)
    if (!isAllowed(cfg.permissionKey)) continue
    targets.push({
      entityName: cfg.entityName,
      basePath: cfg.basePath ?? `/${cfg.entityName}`,
      titleKey: cfg.translations?.listTitle ?? cfg.entityName,
      icon: cfg.icon,
      priority,
    })
  }
  return targets.sort((a, b) => a.priority - b.priority).slice(0, MAX_ACTIVE_TARGETS)
}
