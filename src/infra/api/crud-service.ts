/**
 * Base CRUD Service
 *
 * Generic service class for all CRUD operations with consistent API
 * Provides standardized methods for interacting with ABP backend
 */

import { apiClient } from "./client"
import type { Page } from "@/shared/ports/backend"
import { logger } from "@/shared/logger"

/**
 * Parameters for list/search operations
 */
export interface CRUDListParams {
  pageNumber?: number
  pageSize?: number
  searchKey?: string
  sortBy?: string
  sortDirection?: "asc" | "desc"
  skipCount?: number
  maxResultCount?: number
  sorting?: string
  term?: string
  /** Override the ABP search param name (default "Term"; Role uses "Filter"). */
  searchParam?: string
  /** Allow any custom filters to be passed to the API, including multi-select arrays */
  [key: string]: string | number | boolean | (string | number)[] | undefined
}

/**
 * Configuration for CRUD service
 */
export interface CRUDServiceConfig {
  endpoint: string
  resourceName?: string
}

/**
 * Base CRUD Service Class
 *
 * Provides standardized CRUD operations for all entities
 * Automatically handles pagination, sorting, and filtering
 */
export class BaseCRUDService<
  TEntity extends { id: string | number },
  TCreate = Partial<Omit<TEntity, "id">>,
  TUpdate = Partial<Omit<TEntity, "id">>,
> {
  protected endpoint: string
  protected resourceName: string
  protected client = apiClient

  constructor(config: CRUDServiceConfig | string) {
    const rawEndpoint = typeof config === "string" ? config : config.endpoint
    const normalized = rawEndpoint.startsWith("/") ? rawEndpoint : `/${rawEndpoint}`
    this.endpoint = normalized.startsWith("/api") ? normalized : `/api/app${normalized}`
    if (typeof config === "string") {
      this.resourceName = rawEndpoint.split("/").filter(Boolean).pop() || rawEndpoint
    } else {
      this.resourceName = config.resourceName || rawEndpoint.split("/").filter(Boolean).pop() || rawEndpoint
    }
  }

  /**
   * Get paginated list of entities
   */
  async getList(params?: CRUDListParams): Promise<Page<TEntity>> {
    logger.debug(`[${this.resourceName}] getList`, { params })

    // Normalize parameters to ABP format
    // Support both scalar values and arrays (for multi-select filters)
    const normalizedParams: Record<string, string | number | boolean | (string | number)[] | undefined> = {}

    if (params) {
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
    }

    const response = await this.client.get<Page<TEntity>>(this.endpoint, {
      params: normalizedParams,
      // Serialize arrays as repeated params: documentStatus=1&documentStatus=2
      paramsSerializer: p => {
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
      },
    })

    logger.info(`[${this.resourceName}] getList completed`, {
      totalCount: response.data.totalCount,
      itemsCount: response.data.items.length,
    })

    return response.data
  }

  /**
   * Get single entity by ID
   */
  async getById(id: string | number): Promise<TEntity> {
    logger.debug(`[${this.resourceName}] getById`, { id })

    const response = await this.client.get<TEntity>(`${this.endpoint}/${id}`)

    logger.info(`[${this.resourceName}] getById completed`, { id })

    return response.data
  }

  /**
   * Create new entity
   */
  async create(data: TCreate): Promise<TEntity> {
    logger.debug(`[${this.resourceName}] create`, { data })

    const response = await this.client.post<TEntity>(this.endpoint, data)

    logger.info(`[${this.resourceName}] create completed`, {
      id: "id" in response.data ? (response.data as { id: string | number }).id : "unknown",
    })

    return response.data
  }

  /**
   * Update existing entity
   */
  async update(id: string | number, data: TUpdate): Promise<TEntity> {
    logger.debug(`[${this.resourceName}] update`, { id, data })

    const response = await this.client.put<TEntity>(`${this.endpoint}/${id}`, data)

    logger.info(`[${this.resourceName}] update completed`, { id })

    return response.data
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string | number): Promise<void> {
    logger.debug(`[${this.resourceName}] delete`, { id })

    await this.client.delete(`${this.endpoint}/${id}`)

    logger.info(`[${this.resourceName}] delete completed`, { id })
  }

  /**
   * Autocomplete search for entity selection
   */
  async autocomplete(params?: { term?: string; id?: number; maxResultCount?: number }): Promise<TEntity[]> {
    logger.debug(`[${this.resourceName}] autocomplete`, { params })

    const response = await this.client.get<TEntity[]>(`${this.endpoint}/autocomplete`, { params })

    logger.info(`[${this.resourceName}] autocomplete completed`, {
      resultCount: response.data.length,
    })

    return response.data
  }
}

/**
 * Create CRUD service instance
 *
 * @example
 * ```ts
 * export const warehouseService = createCRUDService<Warehouse>('/warehouse')
 * const users = await warehouseService.getList({ pageSize: 10 })
 * ```
 *
 * This function is preferred over extending BaseCRUDService directly as it:
 * - Reduces boilerplate (no class definition needed)
 * - Provides the same type safety
 * - Returns a frozen instance (immutable)
 */
export function createCRUDService<
  TEntity extends { id: string | number },
  TCreate = Partial<TEntity>,
  TUpdate = Partial<TEntity>,
>(config: CRUDServiceConfig | string) {
  return new BaseCRUDService<TEntity, TCreate, TUpdate>(config)
}
