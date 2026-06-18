/**
 * Security and Settings API Service
 *
 * Domain façade over the ABP permission-management + API-setting endpoints,
 * which live in `adapters/abp/security.adapter`.
 */

import {
  getPermissionsAbp,
  updatePermissionsAbp,
  getApiSettingsAbp,
  updateApiSettingsAbp,
} from "@/infra/api/adapters/abp/security.adapter"
import type { GetPermissionsResponse, UpdatePermissionDto, ApiSetting } from "@/shared/types/security.types"

class SecurityService {
  /**
   * Permission Management
   */
  getPermissions(providerName: string, providerKey: string): Promise<GetPermissionsResponse> {
    return getPermissionsAbp(providerName, providerKey)
  }

  updatePermissions(
    providerName: string,
    providerKey: string,
    input: { permissions: UpdatePermissionDto[] },
  ): Promise<void> {
    return updatePermissionsAbp(providerName, providerKey, input)
  }

  /**
   * API Settings Management
   */
  getApiSettings(
    providerName: string = "G",
    providerKey: string = "",
    fallback: boolean = false,
  ): Promise<ApiSetting[]> {
    return getApiSettingsAbp(providerName, providerKey, fallback)
  }

  updateApiSettings(
    providerName: string = "G",
    providerKey: string = "",
    input: ApiSetting[],
    forceToSet: boolean = true,
  ): Promise<void> {
    return updateApiSettingsAbp(providerName, providerKey, input, forceToSet)
  }
}

export const securityService = new SecurityService()
