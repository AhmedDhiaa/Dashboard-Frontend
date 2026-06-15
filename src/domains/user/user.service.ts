/**
 * User API Service
 * Handles identity user management according to ABP standards
 */

import { BaseCRUDService, apiClient } from "@/infra/api"
import type { IdentityUserRole } from "@/shared/types/security.types"

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
    super("/api/identity/users")
  }

  // Get roles for a specific user
  async getUserRoles(userId: string) {
    const response = await apiClient.get<{ items: IdentityUserRole[] }>(`${this.endpoint}/${userId}/roles`)
    return response.data
  }

  // Update roles for a user
  async updateUserRoles(userId: string, roleNames: string[]) {
    await apiClient.put(`${this.endpoint}/${userId}/roles`, { roleNames })
  }

  // Get roles that can be assigned to a user
  async getAssignableRoles() {
    const response = await apiClient.get<{ items: IdentityUserRole[] }>(`${this.endpoint}/assignable-roles`)
    return response.data
  }
}

export const userService = new IdentityUserService()
