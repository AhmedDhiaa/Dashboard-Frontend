/**
 * ABP CRUD wire conventions.
 *
 * Isolates everything ABP-specific about a CRUD request:
 * - `resolveAbpEndpoint` — the `/api/app/{name}` URL convention.
 * - `toAbpListParams` — translating the neutral `CRUDListParams` into ABP's
 *   query string (`skipCount`/`maxResultCount` paging, `Term`/`Filter` search,
 *   `Sorting` "<field> <asc|desc>").
 * - `abpParamsSerializer` — the repeated-key array serializer ABP expects for
 *   multi-select filters.
 *
 * Kept as pure functions so the generic CRUD service (and any future ABP CRUD
 * adapter) share one source of truth for the wire format. A different backend
 * implements its own conventions in its own adapter folder; this is the only
 * place that knows ABP's URLs and parameter names.
 */

import type { CRUDListParams } from "@/shared/ports/backend"

/**
 * Resolve a logical resource to an ABP URL. Absolute `/api/...` paths pass
 * through untouched; everything else is mounted under the application-service
 * convention `/api/app/{resource}`.
 */
export function resolveAbpEndpoint(rawEndpoint: string): string {
  const normalized = rawEndpoint.startsWith("/") ? rawEndpoint : `/${rawEndpoint}`
  return normalized.startsWith("/api") ? normalized : `/api/app${normalized}`
}

export type AbpQueryParams = Record<string, string | number | boolean | (string | number)[] | undefined>

/** Translate neutral list params into ABP's query-parameter shape. */
export function toAbpListParams(params?: CRUDListParams): AbpQueryParams {
  // Support both scalar values and arrays (for multi-select filters)
  const normalizedParams: AbpQueryParams = {}
  if (!params) return normalizedParams

  const {
    pageNumber,
    pageSize,
    skipCount,
    maxResultCount,
    searchKey,
    term,
    sortBy,
    sortDirection,
    sorting,
    searchParam,
    ...rest
  } = params

  // ABP Pagination: skipCount and maxResultCount are the standard
  if (skipCount !== undefined) {
    normalizedParams.skipCount = skipCount
  } else if (pageNumber !== undefined) {
    normalizedParams.skipCount = pageNumber * (pageSize || 10)
  }

  if (maxResultCount !== undefined) {
    normalizedParams.maxResultCount = maxResultCount
  } else if (pageSize !== undefined) {
    normalizedParams.maxResultCount = pageSize
  }

  // Map search to ABP. Entity endpoints accept `Term`; the Role endpoint
  // accepts `Filter`. Callers pass `searchParam` to override (default "Term").
  const searchValue = searchKey ?? term
  if (searchValue) {
    const key = searchParam || "Term"
    normalizedParams[key] = searchValue
  }

  // Map sort to ABP `Sorting`: "<field> <asc|desc>". Prefer an explicit
  // `sorting` string if a caller already built one.
  if (sorting) {
    normalizedParams.Sorting = sorting
  } else if (sortBy) {
    normalizedParams.Sorting = `${sortBy} ${sortDirection ?? "asc"}`
  }

  // Merge all other custom filters (supports arrays for multi-select)
  Object.assign(normalizedParams, rest)

  return normalizedParams
}

/** Serialize params as repeated keys: `documentStatus=1&documentStatus=2`. */
export function abpParamsSerializer(p: Record<string, unknown>): string {
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(p)) {
    if (val === undefined || val === null) continue
    if (Array.isArray(val)) {
      val.forEach(v => qs.append(key, String(v)))
    } else {
      qs.append(key, String(val))
    }
  }
  return qs.toString()
}
