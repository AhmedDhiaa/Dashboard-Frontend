/**
 * Reports API Service
 *
 * Stock / fuel / inventory reporting endpoints. Each endpoint returns the
 * aggregate the dashboard renders — pages and components do not call the
 * underlying ABP report endpoints directly.
 */

import { apiClient } from "@/infra/api"
import { logger } from "@/shared/logger"

export interface WarehouseQuantity {
  warehouseName: string
  totalQuantity: number
}

export interface FuelItem {
  itemName: string
  totalQuantity: number
  warehouses: WarehouseQuantity[]
}

interface StockTransactionQuantityResponse {
  totalCount: number
  items: FuelItem[]
}

export async function getStockTransactionQuantityByItem(): Promise<FuelItem[]> {
  try {
    const response = await apiClient.get<StockTransactionQuantityResponse>(
      "/api/app/report/stock-transaction-quantity-item",
    )
    return response.data.items ?? []
  } catch (error) {
    logger.error("Failed to fetch stock-transaction-quantity-item report", error)
    throw error
  }
}
