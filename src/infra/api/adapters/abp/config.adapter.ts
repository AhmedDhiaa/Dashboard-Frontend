/**
 * ABP application-config adapter — isolates the one ABP URL
 * (`GET /api/abp/application-configuration`). The service layer keeps its
 * cache / de-dup / invalidation; this module is purely the transport.
 *
 * Returns the raw ABP `ApplicationConfiguration`. A later step can normalize it
 * to the neutral `ConfigPort.getApplicationConfig()` shape and move the
 * permission/settings derivation (currently in `useAppConfig`) in here.
 *
 * Goes through `apiClient`, so mock mode (which swaps the axios adapter) keeps
 * serving the config unchanged.
 */

import { apiClient } from "@/infra/api"
import type { ApplicationConfiguration } from "@/shared/types/application-config.types"
import type { ApplicationConfig, ConfigPort } from "@/shared/ports/backend"
import { toApplicationConfig } from "./config-normalize"

export async function fetchApplicationConfigurationFromAbp(
  includeLocalizationResources: boolean,
): Promise<ApplicationConfiguration> {
  const response = await apiClient.get<ApplicationConfiguration>("/api/abp/application-configuration", {
    params: { IncludeLocalizationResources: includeLocalizationResources },
  })
  return response.data
}

/**
 * ABP implementation of the neutral `ConfigPort`. Fetches the raw ABP config and
 * normalizes it (permissions/settings/features/roles/user) via `config-normalize`.
 * The cached/de-duped fetch path stays in `application-config.service`; this is
 * the port surface a different backend implements its own way.
 */
export const abpConfigPort: ConfigPort = {
  async getApplicationConfig(): Promise<ApplicationConfig> {
    const raw = await fetchApplicationConfigurationFromAbp(false)
    return toApplicationConfig(raw)
  },
}
