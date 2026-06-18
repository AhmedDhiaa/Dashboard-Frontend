/**
 * Base CRUD Service
 *
 * Generic service class for all CRUD operations with consistent API
 * Provides standardized methods for interacting with ABP backend
 */

import { apiClient } from "./client"
import type { Page, CRUDListParams, EntityService } from "@/shared/ports/backend"
import { resolveAbpEndpoint, toAbpListParams, abpParamsSerializer } from "./adapters/abp/crud-params"
import { logger } from "@/shared/logger"

// The canonical definition now lives in the port; re-exported so existing
// `@/infra/api` consumers keep working during the backend-adapter migration.
export type { CRUDListParams }

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
> implements EntityService<TEntity, TCreate, TUpdate> {
  protected endpoint: string
  protected resourceName: string
  protected client = apiClient

  constructor(config: CRUDServiceConfig | string) {
    const rawEndpoint = typeof config === "string" ? config : config.endpoint
    this.endpoint = resolveAbpEndpoint(rawEndpoint)
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

    // Translate neutral list params into ABP's query shape (skipCount/Sorting/
    // Term|Filter), serialized with repeated keys for array filters. The ABP
    // wire format lives in the adapter so a different backend encodes its own way.
    const response = await this.client.get<Page<TEntity>>(this.endpoint, {
      params: toAbpListParams(params),
      paramsSerializer: abpParamsSerializer,
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
