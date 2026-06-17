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

export async function fetchApplicationConfigurationFromAbp(
  includeLocalizationResources: boolean,
): Promise<ApplicationConfiguration> {
  const response = await apiClient.get<ApplicationConfiguration>("/api/abp/application-configuration", {
    params: { IncludeLocalizationResources: includeLocalizationResources },
  })
  return response.data
}
