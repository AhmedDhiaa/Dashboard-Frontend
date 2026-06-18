/**
 * ABP application-config normalization (pure).
 *
 * The single source of truth for turning ABP's `application-configuration`
 * payload into the app's neutral shapes — flattening `grantedPolicies` into a
 * permission-key list, and lifting settings/features/roles/user out of the ABP
 * envelope. Kept free of `apiClient` so both the client hook (`useAppConfig`)
 * and the server session (`server.ts`) can share it without dragging transport
 * into their graphs. A different backend writes its own normalizer.
 */

import type { ApplicationConfig, BackendUser } from "@/shared/ports/backend"
import type { ApplicationConfiguration } from "@/shared/types/application-config.types"

type AbpAuthish = {
  auth?: { grantedPolicies?: Record<string, boolean>; policies?: Record<string, boolean> }
} | null

/** Flatten ABP `grantedPolicies` (with a `policies` fallback) to granted keys. */
export function flattenAbpPermissions(config: AbpAuthish): string[] {
  const policies = config?.auth?.grantedPolicies ?? config?.auth?.policies ?? {}
  return Object.keys(policies).filter(key => policies[key])
}

/** Whether a single permission is granted in an ABP config. */
export function isAbpPermissionGranted(config: AbpAuthish, permission: string): boolean {
  const policies = config?.auth?.grantedPolicies ?? config?.auth?.policies ?? {}
  return policies[permission] === true
}

/** ABP setting values (or empty). */
export function abpSettingValues(
  config: { setting?: { values?: Record<string, string> } } | null,
): Record<string, string> {
  return config?.setting?.values ?? {}
}

/** ABP feature values (or empty). */
export function abpFeatureValues(
  config: { features?: { values?: Record<string, string> } } | null,
): Record<string, string> {
  return config?.features?.values ?? {}
}

/** Map the raw ABP application configuration to the neutral `ApplicationConfig`. */
export function toApplicationConfig(raw: ApplicationConfiguration): ApplicationConfig {
  const cu = raw.currentUser
  const permissions = flattenAbpPermissions(raw)
  const user: BackendUser | null =
    cu && cu.isAuthenticated
      ? {
          id: cu.id ?? "",
          name: cu.name ?? cu.userName ?? undefined,
          email: cu.email ?? undefined,
          roles: cu.roles ?? [],
          tenantId: cu.tenantId,
          permissions,
        }
      : null
  return {
    permissions,
    settings: abpSettingValues(raw),
    features: abpFeatureValues(raw),
    roles: cu?.roles ?? [],
    user,
  }
}
