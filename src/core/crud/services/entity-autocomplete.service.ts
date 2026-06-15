/**
 * Entity Autocomplete Service
 *
 * Thin service layer over the autocomplete and by-id endpoints used by every
 * autocomplete affordance (the standalone `EntityAutocomplete` UI control and
 * the form-field-driven `useEntityAutocomplete` hook). Centralizing the
 * apiClient call here keeps the UI/hook layer free of direct HTTP imports.
 */

import { apiClient } from "@/infra/api"

export type RawEntityItem = Record<string, unknown> & { id: string | number }

export interface SearchAutocompleteOptions {
  /** Entity name (drives the default URL `/api/app/{entityName}/autocomplete`). */
  entityName: string
  /** Override URL — bypasses the entityName-derived path. */
  customEndpoint?: string
  /** Free-text search term. */
  term?: string
  /** Selected entity id (some endpoints accept it alongside `term`). */
  id?: string | number
  /** Force the term param even when `customEndpoint` is set
   *  (used for code-based lookups where the backend must filter). */
  forceTerm?: boolean
  /** Optional abort signal so callers (e.g. command-palette live search) can
   *  cancel stale in-flight requests. axios throws CanceledError on abort. */
  signal?: AbortSignal
}

export interface FetchEntityRecordOptions {
  entityName: string
  id: string | number
  customEndpoint?: string
  basePath?: string
}

function buildSearchUrl(entityName: string, customEndpoint: string | undefined): string {
  if (customEndpoint) {
    return customEndpoint.includes("?") ? customEndpoint.split("?")[0]! : customEndpoint
  }
  return `/api/app/${entityName}/autocomplete`
}

function buildByIdUrl(
  id: string | number,
  entityName: string,
  customEndpoint: string | undefined,
  basePath: string | undefined,
): string {
  if (basePath) return `${basePath}/${id}`

  const isCollection = customEndpoint?.endsWith("/all") || customEndpoint?.endsWith("/autocomplete")

  if (customEndpoint && !isCollection) {
    const base = customEndpoint.includes("?") ? customEndpoint.split("?")[0]! : customEndpoint
    return `${base}/${id}`
  }
  if (customEndpoint && isCollection) {
    return customEndpoint.replace(/\/all$/, `/${id}`).replace(/\/autocomplete$/, `/${id}`)
  }

  return `/api/app/${entityName}/${id}`
}

/**
 * Search the autocomplete endpoint. Returns the unwrapped item array,
 * accepting both `{items: [...]}` and a bare array.
 */
export async function searchEntityAutocomplete(opts: SearchAutocompleteOptions): Promise<RawEntityItem[]> {
  const url = buildSearchUrl(opts.entityName, opts.customEndpoint)

  // Term is sent only when:
  //   - the caller explicitly forces it (used for code-based lookups), or
  //   - there's no custom endpoint at all (the standard /autocomplete path).
  // Custom endpoints — including /all variants — are expected to filter
  // client-side via the hook's localFilter pass.
  const sendTerm = opts.forceTerm === true || (!opts.customEndpoint && !!opts.term)

  const params: Record<string, string | number> = {}
  if (sendTerm && opts.term !== undefined) params.term = opts.term
  if (opts.id !== undefined) params.id = opts.id

  const config: { params?: Record<string, string | number>; signal?: AbortSignal } =
    Object.keys(params).length > 0 ? { params } : opts.customEndpoint ? {} : { params: {} }
  if (opts.signal) config.signal = opts.signal

  const response = await apiClient.get(url, config)
  const raw = response.data as { items?: RawEntityItem[] } | RawEntityItem[] | undefined
  if (Array.isArray(raw)) return raw
  return raw?.items ?? []
}

/** Fetch a single entity by id. Returns null when the endpoint returns no body. */
export async function fetchEntityById(opts: FetchEntityRecordOptions): Promise<RawEntityItem | null> {
  const url = buildByIdUrl(opts.id, opts.entityName, opts.customEndpoint, opts.basePath)
  const response = await apiClient.get<RawEntityItem | null>(url)
  return response.data ?? null
}
