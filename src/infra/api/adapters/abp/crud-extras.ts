/**
 * ABP CRUD sub-resource helpers.
 *
 * Generic operations a domain CRUD service layers on top of its base endpoint —
 * sub-paths, actions, multipart uploads. Kept generic (no domain types) so the
 * ABP transport stays in the adapter layer: the calling service supplies its
 * already-resolved endpoint and the entity type, and never touches `apiClient`
 * or hand-builds an ABP URL itself.
 *
 * Goes through `apiClient`, so mock mode (axios-adapter swap) keeps working.
 */

import { apiClient } from "@/infra/api"

/** GET a sub-resource of an endpoint, e.g. `${endpoint}/current-list`. */
export async function abpGetSub<T>(endpoint: string, sub: string): Promise<T> {
  const { data } = await apiClient.get<T>(`${endpoint}/${sub}`)
  return data
}

/** GET a sub-resource and unwrap the ABP `{ items }` envelope. */
export async function abpGetItems<T>(endpoint: string, sub: string, params?: Record<string, unknown>): Promise<T[]> {
  const { data } = await apiClient.get<{ items: T[] }>(`${endpoint}/${sub}`, { params })
  return data.items
}

/** POST an action sub-path, e.g. `${endpoint}/close/${id}`. */
export async function abpPostAction(
  endpoint: string,
  action: string,
  id: string | number,
  body: unknown = {},
): Promise<void> {
  await apiClient.post(`${endpoint}/${action}/${id}`, body)
}

/** GET a resource addressed by encoded path segments, e.g. by-ref lookups. */
export async function abpGetByPath<T>(endpoint: string, ...segments: (string | number)[]): Promise<T> {
  const path = segments.map(s => encodeURIComponent(String(s))).join("/")
  const { data } = await apiClient.get<T>(`${endpoint}/${path}`)
  return data
}

/** POST multipart form-data to a URL. */
export async function abpPostFormData<T>(url: string, formData: FormData): Promise<T> {
  const { data } = await apiClient.post<T>(url, formData, { headers: { "Content-Type": "multipart/form-data" } })
  return data
}

/** PUT multipart form-data to a URL. */
export async function abpPutFormData<T>(url: string, formData: FormData): Promise<T> {
  const { data } = await apiClient.put<T>(url, formData, { headers: { "Content-Type": "multipart/form-data" } })
  return data
}
