/**
 * ABP CRUD sub-resource helpers.
 *
 * Generic operations a domain CRUD service layers on top of its base endpoint —
 * sub-paths and actions. Kept generic (no domain types) so the ABP transport
 * stays in the adapter layer: the calling service supplies its already-resolved
 * endpoint and the entity type, and never touches `apiClient` or hand-builds an
 * ABP URL itself.
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
