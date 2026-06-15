/**
 * Page Builder action service.
 *
 * `apiClient` is gated by the architectural validator — it may only be
 * imported under `src/infra/**` or by files ending in `.service.ts(x)`.
 * The action executor is a React hook (so it can use `useNotification`,
 * `useRouter`, etc.) and lives under `renderer/`, where the gate would
 * reject it. This file is the thin .service.ts seam: it owns the
 * `apiClient.request` call; the executor imports it from here.
 */

import { apiClient } from "@/infra/api"

export interface PageBuilderApiRequest {
  url: string
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  data?: unknown
}

export async function runPageBuilderApiRequest(req: PageBuilderApiRequest): Promise<unknown> {
  const { url, method, data } = req
  const response = await apiClient.request({ url, method, data })
  return response.data
}
