/**
 * Data-source service for the Page Builder runtime.
 *
 * Architectural-validator gate: `apiClient` may only be imported under
 * `src/infra/**` or by a `*.service.ts(x)` file. `useBlockData.ts` is a
 * React hook (so it can't be `.service.ts`); it delegates the actual
 * `apiClient.request` call to the helpers exported from this file.
 *
 * Two helpers:
 *   - `runDataSourceFetch(req)` — the api-source path. Interpolates
 *     {id}/{entityId}/{token} into the endpoint, builds query params,
 *     and fires the request.
 *   - `resolveSwaggerOperation(url, operationId)` — uses the existing
 *     `/api/admin/page-builder/proxy-swagger` (Phase 5) to find the
 *     `{endpoint, method}` matching an operationId. The proxy already
 *     caches the parsed spec server-side, so this call is cheap.
 */

import { apiClient } from "@/infra/api"
import { API_ROUTES } from "@/shared/api/routes"
import { applyInterpolation } from "./ActionExecutor"
import type { ResourceCluster } from "../openapi/parser"

export interface DataSourceFetchRequest {
  endpoint: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  body?: Record<string, unknown>
  pathParams?: Record<string, string>
  queryParams?: Record<string, unknown>
  itemsPath?: string
  /** Free-form bag for `{id}` / `{entityId}` interpolation in the endpoint. */
  context?: { row?: Record<string, unknown>; entityId?: string | number; params?: Record<string, string | number> }
}

export async function runDataSourceFetch(req: DataSourceFetchRequest): Promise<unknown> {
  // Path-param interpolation runs first so `{id}` / `{entityId}` are
  // resolved before the URL is normalised; pathParams from the schema
  // override anything from `context`.
  const ctxParams = { ...(req.context?.params ?? {}), ...(req.pathParams ?? {}) }
  const url = applyInterpolation(req.endpoint, {
    row: req.context?.row,
    entityId: req.context?.entityId,
    params: ctxParams,
  })
  const response = await apiClient.request({
    url,
    method: req.method,
    data: req.body,
    params: req.queryParams,
  })
  return response.data
}

export interface ResolvedSwaggerOperation {
  endpoint: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
}

interface ProxySwaggerResponse {
  clusters: ResourceCluster[]
  error?: string
}

export async function resolveSwaggerOperation(
  swaggerUrl: string,
  operationId: string,
): Promise<ResolvedSwaggerOperation> {
  const response = await fetch(`${API_ROUTES.pageBuilder.proxySwagger}?url=${encodeURIComponent(swaggerUrl)}`, {
    credentials: "include",
  })
  if (!response.ok) throw new Error(`Swagger proxy returned ${response.status}`)
  const data = (await response.json()) as ProxySwaggerResponse
  if (data.error) throw new Error(data.error)
  for (const cluster of data.clusters) {
    const candidates = [
      cluster.list,
      cluster.create,
      cluster.detail,
      cluster.update,
      cluster.delete,
      ...cluster.customActions,
    ]
    for (const ep of candidates) {
      if (ep?.operationId === operationId) return { endpoint: ep.path, method: ep.method }
    }
  }
  throw new Error(`Operation "${operationId}" not found in swagger spec`)
}
