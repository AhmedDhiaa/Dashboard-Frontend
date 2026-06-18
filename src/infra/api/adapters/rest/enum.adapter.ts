/**
 * REST `EnumPort` — `GET /enums/{type}` → `EnumValueDTO[]`. A backend that
 * already returns `{ id, name, foreignName }` needs no mapping; a differently
 * shaped one maps to the neutral DTO right here.
 */

import { restFetch } from "./transport"
import type { EnumPort, EnumValueDTO } from "@/shared/ports/backend"

export const restEnumPort: EnumPort = {
  async getEnumValues(type: string): Promise<EnumValueDTO[]> {
    const { data } = await restFetch<EnumValueDTO[]>(`/enums/${encodeURIComponent(type)}`)
    return data ?? []
  },
}
