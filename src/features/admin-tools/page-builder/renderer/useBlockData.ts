"use client"

/**
 * Block-data hook — the runtime fetch path that data blocks (kpi, chart,
 * detail, table, alert, map) feed off. Resolves three data-source types:
 *
 *   - `entity`  : looks the entityName up in the registry, calls the
 *                 entity's `service.getById(entityId)` if `params.entityId`
 *                 is present, otherwise `service.getList()`.
 *   - `api`     : fires `apiClient.request(...)` through the
 *                 `data-source.service` seam (architectural-validator
 *                 requires the `apiClient` access to live in a
 *                 `*.service.ts` file).
 *   - `swagger` : resolves the `operationId` to `{endpoint, method}` via
 *                 `/api/admin/page-builder/proxy-swagger` (Phase-5 cache),
 *                 then routes the resolved call through the api branch.
 *
 * Returns `{ data, loading, error, refetch }`. Cancellation is wired so
 * a fast re-render with a different dataSource doesn't race two in-flight
 * requests against the same setState.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { ensureEntityConfig, getEntityConfig } from "@/core/entities/registry"
import { errorReporter } from "@/infra/observability/error-reporter"
import type { DataSource } from "../schema/block-schema"
import { resolveSwaggerOperation, runDataSourceFetch, type DataSourceFetchRequest } from "./data-source.service"

export interface UseBlockDataOptions {
  /** Free-form bag for interpolation + entity getById dispatch. */
  params?: Record<string, string | number>
  /** Set false to opt-out of the fetch (e.g. when nested in a hidden tab). */
  enabled?: boolean
}

export interface UseBlockDataResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

interface ServiceLike {
  getList: (params?: unknown) => Promise<unknown>
  getById: (id: string | number) => Promise<unknown>
}

async function fetchFromEntitySource(
  entityName: string,
  params: Record<string, string | number> | undefined,
): Promise<unknown> {
  await ensureEntityConfig(entityName)
  // The entity registry is typed for 51 different entities — its service
  // is intentionally generic here. Cast to the structural shape we use.
  const config = getEntityConfig(entityName) as unknown as { service: ServiceLike } | null
  if (!config?.service) throw new Error(`No registered entity "${entityName}"`)
  const entityId = params?.entityId
  if (entityId !== undefined) return config.service.getById(entityId)
  return config.service.getList()
}

async function fetchFromApiSource(
  source: Extract<DataSource, { type: "api" }>,
  params: Record<string, string | number> | undefined,
): Promise<unknown> {
  const req: DataSourceFetchRequest = {
    endpoint: source.endpoint,
    method: source.method,
    pathParams: source.pathParams,
    queryParams: source.queryParams,
    itemsPath: source.itemsPath,
    context: { params },
  }
  return runDataSourceFetch(req)
}

async function fetchFromSwaggerSource(
  source: Extract<DataSource, { type: "swagger" }>,
  params: Record<string, string | number> | undefined,
): Promise<unknown> {
  const op = await resolveSwaggerOperation(source.swaggerUrl, source.operationId)
  return runDataSourceFetch({
    endpoint: op.endpoint,
    method: op.method,
    context: { params },
  })
}

async function dispatchFetch(
  dataSource: DataSource,
  params: Record<string, string | number> | undefined,
): Promise<unknown> {
  switch (dataSource.type) {
    case "entity":
      return fetchFromEntitySource(dataSource.entityName, params)
    case "api":
      return fetchFromApiSource(dataSource, params)
    case "swagger":
      return fetchFromSwaggerSource(dataSource, params)
  }
}

export function useBlockData<T = unknown>(
  dataSource: DataSource,
  options: UseBlockDataOptions = {},
): UseBlockDataResult<T> {
  const { enabled = true, params } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const reqIdRef = useRef(0)

  // Stable key so dependency arrays don't trigger on every parent rerender.
  const dataSourceKey = JSON.stringify(dataSource)
  const paramsKey = JSON.stringify(params ?? {})

  const run = useCallback(async () => {
    if (!enabled) return
    const myReq = ++reqIdRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await dispatchFetch(dataSource, params)
      // Discard if a newer request superseded us.
      if (myReq !== reqIdRef.current) return
      setData(result as T)
    } catch (err) {
      if (myReq !== reqIdRef.current) return
      const wrapped = err instanceof Error ? err : new Error("Fetch failed")
      errorReporter.captureException(wrapped, {
        tags: { source: "page-builder.useBlockData", dataSourceType: dataSource.type },
      })
      setError(wrapped)
    } finally {
      if (myReq === reqIdRef.current) setLoading(false)
    }
    // dataSourceKey + paramsKey stand in for deep-equal dataSource/params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceKey, paramsKey, enabled])

  useEffect(() => {
    void run()
  }, [run])

  return { data, loading, error, refetch: run }
}
