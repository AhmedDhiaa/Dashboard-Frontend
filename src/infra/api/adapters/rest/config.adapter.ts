/**
 * REST `ConfigPort` — `GET /me` → the neutral `ApplicationConfig`. A REST backend
 * typically returns an already-flat permission list (no ABP `grantedPolicies`
 * map to flatten), so the mapping is a straight lift into the neutral shape.
 */

import { restFetch } from "./transport"
import type { ApplicationConfig, BackendUser, ConfigPort } from "@/shared/ports/backend"

interface RestMe {
  user: { id: string; name?: string; email?: string; roles?: string[]; tenantId?: string | null } | null
  permissions?: string[]
  settings?: Record<string, string>
  features?: Record<string, string>
  roles?: string[]
}

export const restConfigPort: ConfigPort = {
  async getApplicationConfig(): Promise<ApplicationConfig> {
    const { data } = await restFetch<RestMe>("/me")
    const permissions = data.permissions ?? []
    const user: BackendUser | null = data.user
      ? {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          roles: data.user.roles ?? [],
          tenantId: data.user.tenantId ?? null,
          permissions,
        }
      : null
    return {
      permissions,
      settings: data.settings ?? {},
      features: data.features ?? {},
      roles: data.roles ?? user?.roles ?? [],
      user,
    }
  },
}
