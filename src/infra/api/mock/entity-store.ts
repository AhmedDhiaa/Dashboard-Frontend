/**
 * Entity store — per-entity in-memory CRUD with GENERIC seeding
 * ============================================================
 *
 * One store instance per entity (keyed by the URL resource segment, e.g.
 * `vehicle`, `order`). On first access it deterministically seeds a batch of
 * demo rows for that entity and keeps them in memory for the session.
 *
 * SEED SOURCE — generic, NOT config-driven.
 * -----------------------------------------
 * The store does **not** load the entity-config registry. Earlier it derived
 * the exact field paths an entity renders from its config (`listColumns`,
 * `detailSections`, …). That coupled the mock to the entity-config layer under
 * `@/core/entities`, which transitively imports CLIENT modules
 * (`useEnum` → useEffect, ticket sockets, …). Because this store is reachable
 * from the server-only auth path (`server.ts` → `client.ts` → mock → store),
 * even a *dynamic* `await import(...)` of those configs makes Turbopack's static
 * analysis flag "useEffect in a Server Component" and 500 every route.
 *
 * So instead, each row is seeded from the RESOURCE/ENTITY NAME plus a generous
 * superset of common ABP field patterns: scalar columns (`name`, `code`,
 * `status`, money, dates, geo, …) and nested ABP relation shapes
 * (`<x>Info.entity.name`, `amountInfo.netAmount`, `deliveryInfo.address`, …).
 * The superset is broad enough that most tables/cards/detail pages render
 * something real for whatever entity is requested. Developers who want the
 * exact columns for a specific entity can refine the per-entity seed in this
 * file or in `seed-data.ts`.
 *
 * Everything is deterministic (seeded by entity + row + path via the shared
 * PRNG — never `Math.random`), so a given row is byte-stable across renders,
 * navigations and reloads. `create` / `update` / `delete` mutate the in-memory
 * store and are reflected by subsequent `list` calls, so the app feels like
 * it's talking to a real persistent backend.
 */

import { SeededRandom } from "./prng"
import { generateFieldValue, setPath, type LeafValue } from "./field-factory"

/** A mock row — always has an `id`, everything else is generically seeded. */
export type MockRow = Record<string, unknown> & { id: string | number }

/** Number of demo rows seeded per entity. */
const DEFAULT_SEED_COUNT = 37

/** Default page size when a request doesn't specify one. */
const DEFAULT_PAGE_SIZE = 10

/**
 * Broad superset of common scalar field names every seeded row gets, paired
 * with the column `type` hint the field-factory understands. This is the
 * generic stand-in for the per-entity `listColumns`/`detailSections` we used to
 * read from the config registry — it covers the field names ABP entities in
 * this app overwhelmingly use, so tables render real values for most entities.
 */
const COMMON_SCALAR_FIELDS: Array<{ field: string; type?: string }> = [
  // Identity / labels
  { field: "name", type: "text-primary" },
  { field: "displayName", type: "text-primary" },
  { field: "code", type: "badge-code" },
  { field: "number", type: "badge-code" },
  { field: "documentNum", type: "badge-code" },
  { field: "reference", type: "badge-code" },
  { field: "title" },
  { field: "description" },
  { field: "body" },
  { field: "note" },
  { field: "color" },
  // Status / flags
  { field: "status", type: "badge-status" },
  { field: "statusValue", type: "number" },
  { field: "documentStatus", type: "badge-status" },
  { field: "isActive", type: "boolean" },
  { field: "isDeleted", type: "boolean" },
  // Dates (ABP audit + common business dates)
  { field: "creationTime", type: "date" },
  { field: "createdAt", type: "date" },
  { field: "date", type: "date" },
  { field: "lastModificationTime", type: "date" },
  // Money (IQD)
  { field: "amount", type: "currency" },
  { field: "netAmount", type: "currency" },
  { field: "totalAmount", type: "currency" },
  { field: "price", type: "currency" },
  { field: "balance", type: "currency" },
  // Numerics
  { field: "quantity", type: "number" },
  // Contact
  { field: "phone" },
  { field: "phoneNumber" },
  { field: "email" },
  { field: "address" },
  // Geo
  { field: "latitude" },
  { field: "longitude" },
]

/**
 * Common ABP relation prefixes. Each becomes a nested object so paths like
 * `<x>Info.entity.name` / `<x>Info.entity.code` resolve in tables and cards.
 * A handful carry extra leaves (money totals, an address) so the richer
 * surfaces (order totals, delivery address) have something to show.
 */
const RELATION_PREFIXES = [
  "businessPartnerInfo",
  "salesPersonalInfo",
  "vehicleNumberCountryInfo",
  "cityInfo",
  "areaInfo",
  "categoryInfo",
  "brandInfo",
  "unitInfo",
  "currencyInfo",
  "warehouseInfo",
  "employeeInfo",
  "deliveryInfo",
  "amountInfo",
] as const

export class EntityStore {
  private rows: MockRow[] | null = null
  private pageSize = DEFAULT_PAGE_SIZE
  private loaded = false

  constructor(private readonly entityName: string) {}

  /**
   * Ensure the store is seeded. SYNCHRONOUS — no imports, no config registry.
   * (Kept callable from the async CRUD methods, which `await` nothing here.)
   */
  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    this.rows = this.seedRows()
  }

  /** Build the deterministic seed batch. */
  private seedRows(): MockRow[] {
    const rows: MockRow[] = []
    for (let i = 0; i < DEFAULT_SEED_COUNT; i++) {
      rows.push(this.buildRow(i))
    }
    return rows
  }

  /**
   * Build a single deterministic row at the given seed index. Populates a broad
   * superset of scalar fields plus nested ABP relation shapes, all derived from
   * the entity name + the field path (never config-driven).
   */
  private buildRow(index: number): MockRow {
    const row: MockRow = { id: index + 1 }

    // 1) Scalar superset — the field-factory picks a sensible value per name/type.
    for (const { field, type } of COMMON_SCALAR_FIELDS) {
      const value = generateFieldValue(this.entityName, index, field, type)
      setPath(row, field, value as unknown)
    }

    // 2) Nested ABP relation shapes so `<x>Info.entity.<prop>` paths resolve.
    for (const prefix of RELATION_PREFIXES) {
      setPath(row, prefix, this.buildRelation(prefix, index))
    }

    // 3) Universally-useful fallbacks a few surfaces expect.
    const rng = new SeededRandom(`${this.entityName}:${index}:meta`)
    row.concurrencyStamp = rng.int(100000, 999999).toString(16)
    return row
  }

  /**
   * Build one nested relation object for a `<prefix>Info` field. The base shape
   * is `{ id, entity: { id, name, code } }`; a few well-known prefixes carry
   * extra leaves (money totals, an address) so richer surfaces have data.
   */
  private buildRelation(prefix: string, index: number): Record<string, unknown> {
    const rel: Record<string, unknown> = {
      id: generateFieldValue(this.entityName, index, `${prefix}.id`) as unknown,
      entity: {
        id: generateFieldValue(this.entityName, index, `${prefix}.entity.id`) as unknown,
        name: generateFieldValue(this.entityName, index, `${prefix}.entity.name`) as unknown,
        code: generateFieldValue(this.entityName, index, `${prefix}.entity.code`) as unknown,
      },
    }

    if (prefix === "amountInfo") {
      rel.netAmount = generateFieldValue(this.entityName, index, "amountInfo.netAmount", "currency") as unknown
      rel.totalAmount = generateFieldValue(this.entityName, index, "amountInfo.totalAmount", "currency") as unknown
      rel.amount = generateFieldValue(this.entityName, index, "amountInfo.amount", "currency") as unknown
    }
    if (prefix === "deliveryInfo") {
      rel.address = generateFieldValue(this.entityName, index, "deliveryInfo.address") as unknown
    }

    return rel
  }

  // ── Public CRUD surface ────────────────────────────────────────────────────

  /** Paginated, searched, sorted list in ABP `{ items, totalCount }` shape. */
  async list(params: Record<string, unknown>): Promise<{ items: MockRow[]; totalCount: number }> {
    this.ensureLoaded()
    let items = [...(this.rows ?? [])]

    items = applySearch(items, params)
    items = applyStatusFilters(items, params)
    items = applySort(items, params)

    const totalCount = items.length
    const skip = Number(params.skipCount ?? 0)
    const take = Number(params.maxResultCount ?? this.pageSize)
    const paged = items.slice(skip, skip + (take > 0 ? take : this.pageSize))
    return { items: paged, totalCount }
  }

  /** Get one row by id (string/number tolerant). */
  async getById(id: string | number): Promise<MockRow | undefined> {
    this.ensureLoaded()
    return this.rows!.find(r => String(r.id) === String(id))
  }

  /** Create a row, merging the posted body over a fresh deterministic row. */
  async create(body: Record<string, unknown>): Promise<MockRow> {
    this.ensureLoaded()
    const nextId = this.rows!.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1
    const base = this.buildRow(nextId - 1)
    const row: MockRow = { ...base, ...body, id: nextId, creationTime: new Date().toISOString() }
    this.rows!.unshift(row)
    return row
  }

  /** Update a row in place. Returns undefined if not found. */
  async update(id: string | number, body: Record<string, unknown>): Promise<MockRow | undefined> {
    this.ensureLoaded()
    const idx = this.rows!.findIndex(r => String(r.id) === String(id))
    if (idx === -1) return undefined
    const updated: MockRow = {
      ...this.rows![idx],
      ...body,
      id: this.rows![idx]!.id,
      lastModificationTime: new Date().toISOString(),
    }
    this.rows![idx] = updated
    return updated
  }

  /** Delete a row. Returns true if it existed. */
  async remove(id: string | number): Promise<boolean> {
    this.ensureLoaded()
    const before = this.rows!.length
    this.rows = this.rows!.filter(r => String(r.id) !== String(id))
    return this.rows.length < before
  }

  /** Lightweight autocomplete list ({ id, name }-ish rows). */
  async autocomplete(term?: string, max = 20): Promise<MockRow[]> {
    const { items } = await this.list({ Term: term, maxResultCount: max })
    return items
  }
}

// ── List pipeline helpers ─────────────────────────────────────────────────────

/** Free-text search across the serialized row (Term/Filter/term/searchKey). */
function applySearch(items: MockRow[], params: Record<string, unknown>): MockRow[] {
  const term = (params.Term ?? params.Filter ?? params.term ?? params.searchKey) as string | undefined
  if (!term || !term.trim()) return items
  const q = term.trim().toLowerCase()
  return items.filter(row => JSON.stringify(row).toLowerCase().includes(q))
}

/** Status / DocumentStatus multi-select filters (e.g. Status=1&Status=2). */
function applyStatusFilters(items: MockRow[], params: Record<string, unknown>): MockRow[] {
  let result = items
  for (const key of ["Status", "DocumentStatus"]) {
    const raw = params[key]
    if (raw == null) continue
    const wanted = (Array.isArray(raw) ? raw : [raw]).map(Number).filter(n => !Number.isNaN(n))
    if (wanted.length === 0) continue
    result = result.filter(row => wanted.includes(Number(row.status ?? row.documentStatus)))
  }
  return result
}

/** Sorting — ABP `Sorting: "<field> <asc|desc>"`. Returns a sorted copy. */
function applySort(items: MockRow[], params: Record<string, unknown>): MockRow[] {
  const sorting = params.Sorting as string | undefined
  if (!sorting) return items
  const [sortField, dir = "asc"] = sorting.trim().split(/\s+/)
  if (!sortField) return items
  const sign = dir.toLowerCase() === "desc" ? -1 : 1
  return [...items].sort((a, b) => sign * compareValues(resolve(a, sortField), resolve(b, sortField)))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve a dotted path off a row (mirrors the column factory's resolver). */
function resolve(row: MockRow, path: string): unknown {
  if (!path.includes(".")) return row[path]
  let cursor: unknown = row
  for (const seg of path.split(".")) {
    if (cursor == null) return undefined
    cursor = (cursor as Record<string, unknown>)[seg]
  }
  return cursor
}

/** Type-tolerant comparator for sorting (numbers, dates, strings). */
function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b))
}

// ── Store registry ──────────────────────────────────────────────────────────

const STORES = new Map<string, EntityStore>()

/** Get (or lazily create) the store for an entity resource name. */
export function getStore(entityName: string): EntityStore {
  let store = STORES.get(entityName)
  if (!store) {
    store = new EntityStore(entityName)
    STORES.set(entityName, store)
  }
  return store
}

export type { LeafValue }
