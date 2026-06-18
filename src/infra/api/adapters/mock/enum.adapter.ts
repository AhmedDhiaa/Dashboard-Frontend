/**
 * Mock enum port — standalone-mode `EnumPort`.
 *
 * Serves the bilingual seed enum values directly (no network) when the
 * composition root selects the mock backend. Reuses the same `enumResponse`
 * seed the axios mock adapter uses, so labels are identical whichever path runs.
 */

import type { EnumPort, EnumValueDTO } from "@/shared/ports/backend"
import { enumResponse } from "@/infra/api/mock/handlers/enums"

export const mockEnumPort: EnumPort = {
  async getEnumValues(type: string): Promise<EnumValueDTO[]> {
    return enumResponse(type)
  },
}
