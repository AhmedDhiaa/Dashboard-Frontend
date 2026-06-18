/**
 * ABP security adapter — permission-management + API-setting endpoints.
 *
 * Isolates the ABP framework URLs (`/api/permission-management/*`) and the
 * app-setting convention (`/api/app/api-setting`) the security service relies
 * on, plus ABP's `forceToSet` setting-write shape. Types come from the shared
 * layer, so this stays within the adapter's remit without reaching into
 * `domains`. A different backend implements these its own way.
 *
 * Static paths are string literals so the swagger-drift guardrail can validate
 * them. Goes through `apiClient`, so mock mode (axios-adapter swap) keeps working.
 */

import { apiClient } from "@/infra/api"
import type { GetPermissionsResponse, UpdatePermissionDto, ApiSetting } from "@/shared/types/security.types"

/** Granted/available permissions for a provider (role/user). */
export async function getPermissionsAbp(providerName: string, providerKey: string): Promise<GetPermissionsResponse> {
  const { data } = await apiClient.get<GetPermissionsResponse>("/api/permission-management/permissions", {
    params: { providerName, providerKey },
  })
  return data
}

/** Replace a provider's permission grants. */
export async function updatePermissionsAbp(
  providerName: string,
  providerKey: string,
  input: { permissions: UpdatePermissionDto[] },
): Promise<void> {
  await apiClient.put("/api/permission-management/permissions", input, {
    params: { providerName, providerKey },
  })
}

/** Read API settings for a provider (with optional fallback to defaults). */
export async function getApiSettingsAbp(
  providerName: string,
  providerKey: string,
  fallback: boolean,
): Promise<ApiSetting[]> {
  const { data } = await apiClient.get<ApiSetting[]>("/api/app/api-setting", {
    params: { providerName, providerKey, fallback },
  })
  return data
}

/** Write API settings for a provider (ABP `forceToSet` write shape). */
export async function updateApiSettingsAbp(
  providerName: string,
  providerKey: string,
  input: ApiSetting[],
  forceToSet: boolean,
): Promise<void> {
  await apiClient.put(
    "/api/app/api-setting",
    input.map(s => ({ name: s.name, value: s.value, forceToSet })),
    { params: { providerName, providerKey } },
  )
}
