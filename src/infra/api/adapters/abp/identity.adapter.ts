/**
 * ABP Identity adapter.
 *
 * Isolates the ABP framework identity endpoints (`/api/identity/...`) that the
 * role and user domain services rely on. Types come from the shared layer, so
 * this stays within the adapter's remit (knowing ABP URLs and payloads) without
 * reaching into `domains`. A different backend implements the same operations in
 * its own adapter folder.
 *
 * Static paths are written as string literals (not interpolated consts) so the
 * swagger-drift guardrail can validate them against the live spec.
 *
 * Goes through `apiClient`, so mock mode (axios-adapter swap) keeps working.
 */

import { apiClient } from "@/infra/api"
import type { IdentityRole, IdentityUserRole, GetUserRolesResponse } from "@/shared/types/security.types"

/** Base resources, for the CRUD-port constructors of the role/user services. */
export const ABP_IDENTITY_ROLES_ENDPOINT = "/api/identity/roles"
export const ABP_IDENTITY_USERS_ENDPOINT = "/api/identity/users"

/** Roles currently assigned to a user (role-service view). */
export async function fetchUserRoles(userId: string): Promise<GetUserRolesResponse> {
  const { data } = await apiClient.get<GetUserRolesResponse>(`/api/identity/users/${userId}/roles`)
  return data
}

/** Roles assignable to a user, as `IdentityRole` rows (role-service view). */
export async function fetchAssignableRoles(): Promise<{ items: IdentityRole[] }> {
  const { data } = await apiClient.get<{ items: IdentityRole[] }>("/api/identity/users/assignable-roles")
  return data
}

/** All roles (ABP `/all`), used for role autocomplete. */
export async function fetchAllRoles(): Promise<IdentityRole[]> {
  const { data } = await apiClient.get<{ items: IdentityRole[] }>("/api/identity/roles/all")
  return data.items || []
}

/** Role assignments for a user (user-service view: `IdentityUserRole` rows). */
export async function fetchUserRoleAssignments(userId: string): Promise<{ items: IdentityUserRole[] }> {
  const { data } = await apiClient.get<{ items: IdentityUserRole[] }>(`/api/identity/users/${userId}/roles`)
  return data
}

/** Replace a user's role assignments. */
export async function updateUserRoleAssignments(userId: string, roleNames: string[]): Promise<void> {
  await apiClient.put(`/api/identity/users/${userId}/roles`, { roleNames })
}

/** Roles assignable to a user, as `IdentityUserRole` rows (user-service view). */
export async function fetchAssignableUserRoles(): Promise<{ items: IdentityUserRole[] }> {
  const { data } = await apiClient.get<{ items: IdentityUserRole[] }>("/api/identity/users/assignable-roles")
  return data
}
