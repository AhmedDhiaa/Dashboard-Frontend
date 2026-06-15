/**
 * Security and Settings API Service
 */

import { apiClient } from "@/infra/api"
import type { GetPermissionsResponse, UpdatePermissionDto, ApiSetting } from "@/shared/types/security.types"

class SecurityService {
  /**
   * Permission Management
   */
  async getPermissions(providerName: string, providerKey: string): Promise<GetPermissionsResponse> {
    const response = await apiClient.get<GetPermissionsResponse>("/api/permission-management/permissions", {
      params: { providerName, providerKey },
    })
    return response.data
  }

  async updatePermissions(
    providerName: string,
    providerKey: string,
    input: { permissions: UpdatePermissionDto[] },
  ): Promise<void> {
    await apiClient.put("/api/permission-management/permissions", input, {
      params: { providerName, providerKey },
    })
  }

  /**
   * API Settings Management
   */
  async getApiSettings(
    providerName: string = "G",
    providerKey: string = "",
    fallback: boolean = false,
  ): Promise<ApiSetting[]> {
    const response = await apiClient.get<ApiSetting[]>("/api/app/api-setting", {
      params: { providerName, providerKey, fallback },
    })
    return response.data
  }

  async updateApiSettings(
    providerName: string = "G",
    providerKey: string = "",
    input: ApiSetting[],
    forceToSet: boolean = true,
  ): Promise<void> {
    await apiClient.put(
      "/api/app/api-setting",
      input.map(s => ({ name: s.name, value: s.value, forceToSet })),
      { params: { providerName, providerKey } },
    )
  }
}

export const securityService = new SecurityService()
