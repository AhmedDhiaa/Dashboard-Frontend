/**
 * Role API Service
 * Handles identity role management according to ABP standards
 */

import { BaseCRUDService, apiClient } from "@/infra/api"
import type { IdentityRole, CreateRoleDto, UpdateRoleDto, GetUserRolesResponse } from "@/shared/types/security.types"

class IdentityRoleService extends BaseCRUDService<IdentityRole, CreateRoleDto, UpdateRoleDto> {
  constructor() {
    super("/api/identity/roles")
  }

  // Override getList to match ABP paging/response format if needed
  // BaseCRUDService already handles { items, totalCount } if adapted in the client

  // Get roles for a specific user
  async getUserRoles(userId: string) {
    const response = await apiClient.get<GetUserRolesResponse>(`/api/identity/users/${userId}/roles`)
    return response.data
  }

  // Get roles that can be assigned to a user
  async getAssignableRoles() {
    const response = await apiClient.get<{ items: IdentityRole[] }>("/api/identity/users/assignable-roles")
    return response.data
  }

  /**
   * Get all roles for autocomplete
   * ABP endpoint: /api/identity/roles/all
   */
  override async autocomplete(): Promise<IdentityRole[]> {
    const response = await apiClient.get<{ items: IdentityRole[] }>("/api/identity/roles/all")
    return response.data.items || []
  }

  // Permission management is handled by SecurityService
}

export const roleService = new IdentityRoleService()
