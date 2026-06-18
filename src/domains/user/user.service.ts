/**
 * User API Service
 * Handles identity user management according to ABP standards.
 *
 * ABP identity endpoints live in `adapters/abp/identity.adapter`; this service
 * is the domain-facing façade over the CRUD port + those operations.
 */

import { BaseCRUDService } from "@/infra/api"
import {
  ABP_IDENTITY_USERS_ENDPOINT,
  fetchUserRoleAssignments,
  updateUserRoleAssignments,
  fetchAssignableUserRoles,
} from "@/infra/api/adapters/abp/identity.adapter"

export interface IdentityUser {
  id: string
  userName: string
  email: string
  name?: string
  surname?: string
  phoneNumber?: string
  isActive: boolean
  creationTime: string
}

export interface CreateUserDto {
  userName: string
  email: string
  password?: string
  name?: string
  surname?: string
  phoneNumber?: string
  isActive?: boolean
  roleNames?: string[]
}

export interface UpdateUserDto {
  userName?: string
  email?: string
  password?: string
  name?: string
  surname?: string
  phoneNumber?: string
  isActive?: boolean
  roleNames?: string[]
}

class IdentityUserService extends BaseCRUDService<IdentityUser, CreateUserDto, UpdateUserDto> {
  constructor() {
    super(ABP_IDENTITY_USERS_ENDPOINT)
  }

  /** Role assignments for a specific user. */
  getUserRoles(userId: string) {
    return fetchUserRoleAssignments(userId)
  }

  /** Replace a user's role assignments. */
  updateUserRoles(userId: string, roleNames: string[]) {
    return updateUserRoleAssignments(userId, roleNames)
  }

  /** Roles that can be assigned to a user. */
  getAssignableRoles() {
    return fetchAssignableUserRoles()
  }
}

export const userService = new IdentityUserService()
