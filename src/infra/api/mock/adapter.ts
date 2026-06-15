/**
 * Mock axios adapter
 * ==================
 *
 * The single entrypoint that replaces axios's network layer when `IS_MOCK` is
 * true (wired in `src/infra/api/client.ts`). It NEVER touches the network:
 * every request is inspected (`url`, `method`, `params`, `data`), routed to a
 * handler, and answered with a seeded `AxiosResponse`.
 *
 * Routing order (first match wins):
 *   1. ABP app-configuration → demo Admin + all permissions.
 *   2. Bespoke endpoints: dashboard counts, order-on-map, enums, notifications.
 *   3. The `area` entity (needs polygons) → dedicated maps handler.
 *   4. Everything else → the GENERIC ABP CRUD handler, which derives its rows
 *      from the entity's own config (see `entity-store.ts`).
 *
 * A small artificial latency (150–400ms) is added so loading states/skeletons
 * actually show, making the mock feel like a real backend.
 *
 * Adding a new bespoke endpoint = add a branch in `routeRequest`. Adding a new
 * entity = nothing (the generic handler picks it up from its config).
 */

import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios"
import { getStore } from "./entity-store"
import { dashboardResponse } from "./handlers/dashboard"
import {
  orderOnMapResponse,
  addOrderPoint,
  areaListResponse,
  getArea,
  addArea,
  updateArea,
  deleteArea,
} from "./handlers/maps"
import { enumResponse } from "./handlers/enums"
import { mockApplicationConfiguration } from "./handlers/auth"
import { identityResponse } from "./handlers/identity"
import { permissionsResponse, apiSettingsResponse } from "./handlers/security"
import { SeededRandom } from "./prng"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a well-formed AxiosResponse for the mock. */
function ok<T>(data: T, config: InternalAxiosRequestConfig, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? "OK" : status === 201 ? "Created" : "No Content",
    headers: {},
    config,
    request: {},
  }
}

/**
 * Upper bound (ms) for the mock's artificial per-request latency, tunable via
 * `NEXT_PUBLIC_MOCK_LATENCY_MS`. The latency exists ONLY so loading skeletons
 * flash in the backend-free demo — a real backend never pays it. The previous
 * 150–400ms range was the dominant per-navigation delay in mock mode, so the
 * default is now a snappy 80ms ceiling (navigation feels near-instant while
 * skeletons still mount briefly). Set `NEXT_PUBLIC_MOCK_LATENCY_MS=0` to disable.
 */
const LATENCY_MAX_MS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS)
  return Number.isFinite(raw) && raw >= 0 ? raw : 80
})()

/** Deterministic-ish latency so loading states are visible. */
function latency(seed: string): Promise<void> {
  if (LATENCY_MAX_MS <= 0) return Promise.resolve()
  const min = Math.floor(LATENCY_MAX_MS / 3)
  const ms = new SeededRandom(`latency:${seed}`).int(min, LATENCY_MAX_MS)
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Parse the request body (axios may hand it over as a JSON string). */
function parseBody(data: unknown): Record<string, unknown> {
  if (!data) return {}
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  if (typeof data === "object") return data as Record<string, unknown>
  return {}
}

/** Normalize axios params (URLSearchParams or plain object) to a record. */
function normalizeParams(params: unknown): Record<string, unknown> {
  if (!params) return {}
  if (params instanceof URLSearchParams) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of params.entries()) {
      // Collapse repeated keys into arrays (multi-select filters).
      if (k in out) {
        const existing = out[k]
        out[k] = Array.isArray(existing) ? [...existing, v] : [existing, v]
      } else {
        out[k] = v
      }
    }
    return out
  }
  return params as Record<string, unknown>
}

/**
 * Strip the leading `/api/app/` or `/api/` and trailing query to get the
 * resource path, e.g. `/api/app/vehicle/123` → `vehicle/123`.
 */
function resourcePath(url: string): string {
  const noQuery = url.split("?")[0] ?? url
  const noBase = noQuery.replace(/^https?:\/\/[^/]+/, "")
  return noBase
    .replace(/^\/api\/app\//, "")
    .replace(/^\/api\//, "")
    .replace(/^\//, "")
    .replace(/\/$/, "")
}

// ── Router ──────────────────────────────────────────────────────────────────

/**
 * ABP identity + permission-management + application settings live outside the
 * `/api/app/<entity>` namespace, so they're routed here rather than through the
 * generic CRUD handler. Returns `null` when `path` is none of these.
 */
function routeIdentityAndSecurity(
  path: string,
  method: string,
  params: Record<string, unknown>,
  body: Record<string, unknown>,
  config: InternalAxiosRequestConfig,
): AxiosResponse | null {
  if (path.startsWith("identity/")) {
    const result = identityResponse(path, method, params, body)
    const status = method === "post" ? 201 : method === "delete" ? 204 : 200
    return ok(result, config, status)
  }
  if (path.startsWith("permission-management/")) {
    if (method === "put") return ok(null, config, 204)
    return ok(permissionsResponse(params), config)
  }
  if (path === "api-setting") {
    if (method === "put") return ok(null, config, 204)
    return ok(apiSettingsResponse(), config)
  }
  return null
}

async function routeRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const url = config.url ?? ""
  const method = (config.method ?? "get").toLowerCase()
  const params = normalizeParams(config.params)
  const body = parseBody(config.data)
  const path = resourcePath(url)

  // 1) ABP application-configuration → demo admin + all permissions.
  if (url.includes("abp/application-configuration")) {
    return ok(mockApplicationConfiguration(), config)
  }

  // 2) Dashboard count endpoints: app/dashboard/<sub-path>.
  if (path.startsWith("dashboard/")) {
    return ok(dashboardResponse(path.replace("dashboard/", "")), config)
  }

  // 3) Order-on-map report (markers).
  if (path.startsWith("report/order-on-map")) {
    if (method === "post") return ok(addOrderPoint(body), config, 201)
    return ok(orderOnMapResponse(params), config)
  }

  // 4) Enums: app/enum/<enumType>.
  if (path.startsWith("enum/")) {
    return ok(enumResponse(path.replace("enum/", "")), config)
  }

  // 4b) ABP Identity / permission-management / settings — endpoints that live
  // outside `/api/app`, so the generic CRUD handler can't serve them.
  const identitySecurity = routeIdentityAndSecurity(path, method, params, body, config)
  if (identitySecurity) return identitySecurity

  // 5) Notifications current-list (custom endpoint on the notification service).
  if (path === "notification/current-list") {
    const { items, totalCount } = await getStore("notification").list({ maxResultCount: 15 })
    return ok({ items, totalCount }, config)
  }

  // 6) Area entity — needs polygons, served by the maps handler.
  if (path === "area" || path.startsWith("area/") || path.startsWith("area?")) {
    return routeArea(path, method, params, body, config)
  }

  // 7) Generic ABP CRUD for every other entity.
  return routeGenericCrud(path, method, params, body, config)
}

/** Area CRUD (list/getById/create/update/delete + autocomplete). */
async function routeArea(
  path: string,
  method: string,
  params: Record<string, unknown>,
  body: Record<string, unknown>,
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  const segments = path.split("/")
  const id = segments[1]

  if (path === "area" && method === "get") return ok(areaListResponse(params), config)
  if (method === "post" && path === "area") return ok(addArea(body), config, 201)
  if (segments[1] === "autocomplete") return ok(areaListResponse({ maxResultCount: 20 }).items, config)

  if (id && method === "get") {
    const area = getArea(id)
    return area ? ok(area, config) : ok({ message: "Not found" }, config, 404)
  }
  if (id && method === "put") {
    const updated = updateArea(id, body)
    return updated ? ok(updated, config) : ok({ message: "Not found" }, config, 404)
  }
  if (id && method === "delete") {
    deleteArea(id)
    return ok(null, config, 204)
  }
  return ok(areaListResponse(params), config)
}

/**
 * Generic ABP CRUD handler. Works for EVERY entity by deriving the resource
 * name from the URL and delegating to that entity's config-driven store.
 *
 * Recognised shapes:
 *   GET    <entity>                     → list  { items, totalCount }
 *   GET    <entity>/autocomplete        → array of light rows
 *   GET    <entity>/<id>                → single row
 *   POST   <entity>                     → create (echoes the new row)
 *   PUT    <entity>/<id>                → update
 *   DELETE <entity>/<id>                → delete (204)
 */
async function routeGenericCrud(
  path: string,
  method: string,
  params: Record<string, unknown>,
  body: Record<string, unknown>,
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  const segments = path.split("/").filter(Boolean)
  const entity = segments[0] ?? "unknown"
  const second = segments[1]
  const store = getStore(entity)

  // Collection-level operations
  if (!second) {
    if (method === "get") return ok(await store.list(params), config)
    if (method === "post") return ok(await store.create(body), config, 201)
  }

  // <entity>/autocomplete
  if (second === "autocomplete") {
    const term = (params.term ?? params.Term) as string | undefined
    return ok(await store.autocomplete(term), config)
  }

  // <entity>/<id> operations
  if (second) {
    if (method === "get") {
      const row = await store.getById(second)
      return row ? ok(row, config) : ok({ message: "Not found", resource: entity }, config, 404)
    }
    if (method === "put") {
      const row = await store.update(second, body)
      return row ? ok(row, config) : ok({ message: "Not found", resource: entity }, config, 404)
    }
    if (method === "delete") {
      await store.remove(second)
      return ok(null, config, 204)
    }
  }

  // Fallback: an empty ABP list keeps any unexpected GET safe.
  return ok({ items: [], totalCount: 0 }, config)
}

/**
 * The axios adapter. Exposed as a plain function so it can be assigned to
 * `apiClient.defaults.adapter`.
 */
export const mockAdapter: AxiosAdapter = async config => {
  await latency(config.url ?? "")
  return routeRequest(config as InternalAxiosRequestConfig)
}
