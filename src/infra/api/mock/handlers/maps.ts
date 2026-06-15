/**
 * Maps / KPIs handler
 * ===================
 *
 * Seeds the two map surfaces:
 *
 *   1. `/api/app/report/order-on-map` — vehicle/order markers with Iraqi
 *      coordinates + heading angle (see `kpis.types.ts → OrderOnMapResponse`).
 *   2. The `area` entity (`/api/app/area`) — polygons with ≥3 boundary points
 *      so the KPIs map and the "areas" overlay have real shapes to draw, and
 *      so "add area" has a populated map to work on.
 *
 * Both datasets are kept in module-level memory: adding a point or an area
 * mutates the store and the next fetch reflects it (so the map feels live).
 */

import { SeededRandom } from "../prng"
import { IRAQI_CITIES } from "../seed-data"

// ── Order-on-map markers ────────────────────────────────────────────────────

interface OrderMapItem {
  documentRef: string
  documentDate: string
  documentStatus: number
  locationPoint: { longitude: number; latitude: number; angle: number }
}

let _orderPoints: OrderMapItem[] | null = null

/** Deterministically scatter markers around Iraqi city centres. */
function seedOrderPoints(): OrderMapItem[] {
  const points: OrderMapItem[] = []
  for (let i = 0; i < 60; i++) {
    const rng = new SeededRandom(`order-on-map:${i}`)
    const city = IRAQI_CITIES[i % IRAQI_CITIES.length]!
    points.push({
      documentRef: `ORD-${rng.int(10_000, 99_999)}`,
      documentDate: new Date(Date.now() - rng.int(0, 30) * 86_400_000).toISOString(),
      documentStatus: rng.int(1, 6),
      locationPoint: {
        latitude: city.lat + rng.decimal(-0.08, 0.08, 5),
        longitude: city.lng + rng.decimal(-0.08, 0.08, 5),
        angle: rng.int(0, 359),
      },
    })
  }
  return points
}

/** Orders-on-map response, filtered by status/term/paging like the real API. */
export function orderOnMapResponse(params: Record<string, unknown>): {
  totalCount: number
  items: OrderMapItem[]
} {
  if (!_orderPoints) _orderPoints = seedOrderPoints()
  let items = [..._orderPoints]

  const status = params.DocumentStatus
  if (status != null) {
    const n = Number(status)
    if (!Number.isNaN(n)) items = items.filter(p => p.documentStatus === n)
  }
  const term = params.Term as string | undefined
  if (term && term.trim()) {
    const q = term.trim().toLowerCase()
    items = items.filter(p => p.documentRef.toLowerCase().includes(q))
  }

  const skip = Number(params.SkipCount ?? 0)
  const take = Number(params.MaxResultCount ?? items.length)
  return { totalCount: items.length, items: items.slice(skip, skip + take) }
}

/** Add a marker (used so "add point" updates the live store). */
export function addOrderPoint(body: Record<string, unknown>): OrderMapItem {
  if (!_orderPoints) _orderPoints = seedOrderPoints()
  const rng = new SeededRandom(`order-on-map:new:${_orderPoints.length}`)
  const loc = (body.locationPoint ?? {}) as Record<string, unknown>
  const point: OrderMapItem = {
    documentRef: (body.documentRef as string) ?? `ORD-${rng.int(10_000, 99_999)}`,
    documentDate: new Date().toISOString(),
    documentStatus: Number(body.documentStatus ?? rng.int(1, 6)),
    locationPoint: {
      latitude: Number(loc.latitude ?? IRAQI_CITIES[0]!.lat),
      longitude: Number(loc.longitude ?? IRAQI_CITIES[0]!.lng),
      angle: Number(loc.angle ?? 0),
    },
  }
  _orderPoints.unshift(point)
  return point
}

// ── Area polygons ────────────────────────────────────────────────────────────

interface AreaBoundary {
  longitude: number
  latitude: number
  angle: number
}

interface AreaRow {
  id: number
  code: string
  name: string
  foreignName: string
  cityInfo: { id: number; name: string; entity: { name: string } }
  boundaries: AreaBoundary[]
  isSystem: boolean
  creationTime: string
  note: string
  concurrencyStamp: string
}

let _areas: AreaRow[] | null = null

/** Build a roughly-rectangular polygon of N points around a centre. */
function polygonAround(lat: number, lng: number, rng: SeededRandom): AreaBoundary[] {
  const r = rng.decimal(0.02, 0.06, 4)
  const corners = [
    [lat + r, lng - r],
    [lat + r, lng + r],
    [lat - r, lng + r],
    [lat - r, lng - r],
  ]
  return corners.map(([la, ln]) => ({ latitude: la!, longitude: ln!, angle: 0 }))
}

const AREA_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"]

/** Seed one polygon per city centre. */
function seedAreas(): AreaRow[] {
  return IRAQI_CITIES.slice(0, 8).map((city, i) => {
    const rng = new SeededRandom(`area:${i}`)
    return {
      id: i + 1,
      code: `AR-${100 + i}`,
      name: `منطقة ${city.ar}`,
      foreignName: `${city.en} Zone`,
      cityInfo: { id: i + 1, name: city.ar, entity: { name: city.ar } },
      boundaries: polygonAround(city.lat, city.lng, rng),
      isSystem: false,
      creationTime: new Date(Date.now() - rng.int(0, 200) * 86_400_000).toISOString(),
      note: AREA_COLORS[i % AREA_COLORS.length]!,
      concurrencyStamp: rng.int(100000, 999999).toString(16),
    }
  })
}

/** Area list in ABP `{ items, totalCount }` shape. */
export function areaListResponse(params: Record<string, unknown>): { items: AreaRow[]; totalCount: number } {
  if (!_areas) _areas = seedAreas()
  const skip = Number(params.skipCount ?? params.SkipCount ?? 0)
  const take = Number(params.maxResultCount ?? params.MaxResultCount ?? _areas.length)
  return { items: _areas.slice(skip, skip + take), totalCount: _areas.length }
}

export function getArea(id: string | number): AreaRow | undefined {
  if (!_areas) _areas = seedAreas()
  return _areas.find(a => String(a.id) === String(id))
}

/** Create an area (used by "add area" so the new polygon persists + redraws). */
export function addArea(body: Record<string, unknown>): AreaRow {
  if (!_areas) _areas = seedAreas()
  const rng = new SeededRandom(`area:new:${_areas.length}`)
  const nextId = _areas.reduce((m, a) => Math.max(m, a.id), 0) + 1
  const city = IRAQI_CITIES[0]!
  const incomingBoundaries = body.boundaries as AreaBoundary[] | undefined
  const area: AreaRow = {
    id: nextId,
    code: (body.code as string) ?? `AR-${100 + nextId}`,
    name: (body.name as string) ?? `منطقة جديدة ${nextId}`,
    foreignName: (body.foreignName as string) ?? `New Zone ${nextId}`,
    cityInfo: { id: nextId, name: city.ar, entity: { name: city.ar } },
    boundaries:
      incomingBoundaries && incomingBoundaries.length >= 3 ? incomingBoundaries : polygonAround(city.lat, city.lng, rng),
    isSystem: false,
    creationTime: new Date().toISOString(),
    note: (body.note as string) ?? AREA_COLORS[nextId % AREA_COLORS.length]!,
    concurrencyStamp: rng.int(100000, 999999).toString(16),
  }
  _areas.unshift(area)
  return area
}

export function updateArea(id: string | number, body: Record<string, unknown>): AreaRow | undefined {
  if (!_areas) _areas = seedAreas()
  const idx = _areas.findIndex(a => String(a.id) === String(id))
  if (idx === -1) return undefined
  _areas[idx] = { ...(_areas[idx] as AreaRow), ...body, id: _areas[idx]!.id }
  return _areas[idx]
}

export function deleteArea(id: string | number): boolean {
  if (!_areas) _areas = seedAreas()
  const before = _areas.length
  _areas = _areas.filter(a => String(a.id) !== String(id))
  return _areas.length < before
}
