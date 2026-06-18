/**
 * Role API Service
 * Handles identity role management according to ABP standards.
 *
 * ABP identity endpoints live in `adapters/abp/identity.adapter`; this service
 * is the domain-facing façade over the CRUD port + those operations.
 */

import { BaseCRUDService } from "@/infra/api"
import {
  ABP_IDENTITY_ROLES_ENDPOINT,
  fetchUserRoles,
  fetchAssignableRoles,
  fetchAllRoles,
} from "@/infra/api/adapters/abp/identity.adapter"
import type { IdentityRole, CreateRoleDto, UpdateRoleDto } from "@/shared/types/security.types"

class IdentityRoleService extends BaseCRUDService<IdentityRole, CreateRoleDto, UpdateRoleDto> {
  constructor() {
    super(ABP_IDENTITY_ROLES_ENDPOINT)
  }

  /** Roles assigned to a specific user. */
  getUserRoles(userId: string) {
    return fetchUserRoles(userId)
  }

  /** Roles that can be assigned to a user. */
  getAssignableRoles() {
    return fetchAssignableRoles()
  }

  /** All roles, for autocomplete. */
  override autocomplete(): Promise<IdentityRole[]> {
    return fetchAllRoles()
  }
}

export const roleService = new IdentityRoleService()
