/**
 * ABP enum adapter — implements `EnumPort` against ABP's
 * `GET /api/app/enum/<type>` endpoint. This is the only place that ABP enum URL
 * lives; a different backend supplies enums by implementing `EnumPort`.
 *
 * The call goes through `apiClient`, so mock mode (which swaps the axios
 * adapter) keeps serving enums unchanged.
 */

import { apiClient } from "@/infra/api/client"
import { logger } from "@/shared/logger"
import type { EnumPort, EnumValueDTO } from "@/shared/ports/backend"

export const abpEnumPort: EnumPort = {
  async getEnumValues(type) {
    try {
      const response = await apiClient.get<EnumValueDTO[]>(`/api/app/enum/${type}`)
      return response.data
    } catch (error) {
      logger.error(`[abpEnumPort] Failed to fetch enum: ${type}`, error)
      throw error
    }
  },
}
