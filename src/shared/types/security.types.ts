/**
 * Security and Identity Types
 */

export interface IdentityRole {
  id: string
  name: string
  isDefault: boolean
  isStatic: boolean
  isPublic: boolean
  concurrencyStamp: string
  creationTime: string
  extraProperties?: Record<string, unknown>
}

export interface CreateRoleDto {
  name: string
  isDefault?: boolean
  isPublic?: boolean
}

export interface UpdateRoleDto {
  name: string
  isDefault?: boolean
  isPublic?: boolean
  concurrencyStamp?: string
}

export interface IdentityUserRole {
  id: string
  name: string
  isDefault: boolean
  isStatic: boolean
  isPublic: boolean
  concurrencyStamp: string
  creationTime: string
  extraProperties?: Record<string, unknown>
}

export interface GetUserRolesResponse {
  items: IdentityUserRole[]
}

export interface ApiSetting {
  name: string
  value: string
  providerName?: string
  providerKey?: string
}

export interface PermissionDto {
  name: string
  displayName: string
  parentName?: string
  isGranted: boolean
  allowedProviders?: string[]
  grantedProviders?: { providerName: string; providerKey: string }[]
}

export interface PermissionGroupDto {
  name: string
  displayName: string
  displayNameKey?: string | null
  displayNameResource?: string | null
  permissions: PermissionDto[]
}

export interface GetPermissionsResponse {
  entityDisplayName: string
  groups: PermissionGroupDto[]
}

export interface UpdatePermissionDto {
  name: string
  isGranted: boolean
}
