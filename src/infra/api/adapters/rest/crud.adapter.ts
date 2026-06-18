/**
 * REST `EntityService<T>` — CRUD against a conventional collection endpoint
 * (`/{resource}`), translating the neutral `CRUDListParams` into REST query
 * conventions (`_page`/`_limit`/`_sort`/`_order`/`q`) and the `{ data, total }`
 * list envelope into the neutral `Page<T>`.
 *
 * This is the whole point of the port: ABP encodes the same list as
 * `skipCount`/`Sorting`/`Term` with an `{ items, totalCount }` envelope; a REST
 * backend does it completely differently — and app code notices neither.
 */

import { restFetch } from "./transport"
import type { CRUDListParams, EntityService, Page } from "@/shared/ports/backend"

interface RestList<T> {
  data: T[]
  total: number
}

/** Translate neutral list params → REST query string (1-based pages). */
export function toRestQuery(params?: CRUDListParams): string {
  if (!params) return ""
  const q = new URLSearchParams()

  const limit = params.pageSize ?? params.maxResultCount
  const page =
    params.pageNumber ?? (params.skipCount != null && limit ? Math.floor(params.skipCount / limit) : undefined)
  if (page != null) q.set("_page", String(page + 1)) // REST pagination is 1-based
  if (limit != null) q.set("_limit", String(limit))

  const search = params.searchKey ?? params.term
  if (search) q.set("q", String(search))

  if (params.sortBy) {
    q.set("_sort", params.sortBy)
    q.set("_order", params.sortDirection ?? "asc")
  }

  const s = q.toString()
  return s ? `?${s}` : ""
}

export function restEntity<
  TEntity extends { id: string | number },
  TCreate = Partial<TEntity>,
  TUpdate = Partial<TEntity>,
>(resource: string): EntityService<TEntity, TCreate, TUpdate> {
  const base = `/${resource.replace(/^\//, "")}`

  return {
    async getList(params?: CRUDListParams): Promise<Page<TEntity>> {
      const { data } = await restFetch<RestList<TEntity>>(`${base}${toRestQuery(params)}`)
      return { items: data.data, totalCount: data.total }
    },

    async getById(id: string | number): Promise<TEntity> {
      return (await restFetch<TEntity>(`${base}/${id}`)).data
    },

    async create(payload: TCreate): Promise<TEntity> {
      return (await restFetch<TEntity>(base, { method: "POST", body: JSON.stringify(payload) })).data
    },

    async update(id: string | number, payload: TUpdate): Promise<TEntity> {
      return (await restFetch<TEntity>(`${base}/${id}`, { method: "PUT", body: JSON.stringify(payload) })).data
    },

    async delete(id: string | number): Promise<void> {
      await restFetch(`${base}/${id}`, { method: "DELETE" })
    },

    async autocomplete(params?: { term?: string; id?: number; maxResultCount?: number }): Promise<TEntity[]> {
      const q = new URLSearchParams()
      if (params?.term) q.set("q", params.term)
      if (params?.maxResultCount) q.set("_limit", String(params.maxResultCount))
      const s = q.toString()
      const { data } = await restFetch<RestList<TEntity>>(`${base}${s ? `?${s}` : ""}`)
      return data?.data ?? []
    },
  }
}
