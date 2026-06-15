/**
 * Auth + authorization handler
 * ============================
 *
 * Makes login and permissions work fully offline:
 *
 *   - {@link mockTokenResponse} — a fake OAuth2 token bundle returned by
 *     `oauth2.service.login()` when `IS_MOCK` (any non-empty credentials pass;
 *     demo/demo is the documented pair).
 *   - {@link mockApplicationConfiguration} — the ABP
 *     `/api/abp/application-configuration` payload with a "Demo Admin" user,
 *     the `admin` role, and an **all-true `grantedPolicies` map** so every nav
 *     item and CRUD action is visible.
 *   - {@link mockUserProfile} — the slim profile the NextAuth server callback
 *     builds its session from (server.ts `fetchUserProfile`).
 *
 * The granted-policies map is built from the central `PERMISSIONS` registry
 * plus synthesized `<entityKey>.Create|.Update|.Delete|.View` permissions for
 * every known entity, so authorization is correct even if the `admin`-role
 * bypass is ever tightened.
 */

import { BRAND_DOMAIN } from "@/shared/config/brand"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import type { ApplicationConfiguration } from "@/shared/types/application-config.types"

// NOTE: do NOT import the entity-config layer under `@/core/entities` here.
// This module is pulled into the server-only NextAuth path (server.ts →
// route.ts), and the entity configs transitively import client modules
// (`useEnum` → useEffect), which makes Turbopack 500 every route with
// "useEffect in a Server Component". The demo user is an `admin`, and
// PermissionContext treats `isAdmin` as an all-access bypass, so per-entity
// permission keys aren't needed for nav/CRUD visibility anyway.

/** Stable fake tokens — opaque strings, never sent anywhere real. */
export const MOCK_ACCESS_TOKEN = "mock-access-token.demo-admin.standalone"
export const MOCK_REFRESH_TOKEN = "mock-refresh-token.demo-admin.standalone"

/** OAuth2 password/refresh-grant response used by oauth2.service. */
export function mockTokenResponse() {
  return {
    access_token: MOCK_ACCESS_TOKEN,
    refresh_token: MOCK_REFRESH_TOKEN,
    expires_in: 8 * 60 * 60, // 8h — matches the app's session lifetime
    token_type: "Bearer",
    scope: "Api offline_access",
  }
}

/**
 * Build the all-true grantedPolicies map. Includes:
 *   - every literal in PERMISSIONS,
 *   - common ABP module roots used as namespace permissions,
 *   - `<Api.Entity>` + CRUD variants for every entity name the registry knows.
 */
function buildGrantedPolicies(): Record<string, boolean> {
  const policies: Record<string, boolean> = {}

  for (const key of Object.values(PERMISSIONS)) policies[key] = true

  // A few well-known ABP identity / settings permissions some surfaces probe.
  for (const key of [
    "AbpIdentity.Users",
    "AbpIdentity.Roles",
    "AbpIdentity.Users.Create",
    "AbpIdentity.Users.Update",
    "AbpIdentity.Users.Delete",
    "SettingManagement.Emailing",
    "FeatureManagement.ManageHostFeatures",
  ]) {
    policies[key] = true
  }

  return policies
}

/** The demo user shown across the app. */
export function mockCurrentUser() {
  return {
    isAuthenticated: true,
    id: "demo-admin-0000-0000-0000-000000000001",
    tenantId: null,
    impersonatorUserId: null,
    impersonatorTenantId: null,
    impersonatorUserName: null,
    impersonatorTenantName: null,
    userName: "demo",
    name: "Demo",
    surName: "Admin",
    email: `demo@${BRAND_DOMAIN}`,
    emailVerified: true,
    phoneNumber: "07700000000",
    phoneNumberVerified: true,
    roles: ["admin"],
    sessionId: "mock-session",
  }
}

/** Full ABP application-configuration payload for the demo session. */
export function mockApplicationConfiguration(): ApplicationConfiguration {
  const grantedPolicies = buildGrantedPolicies()
  return {
    currentUser: mockCurrentUser(),
    auth: { grantedPolicies, policies: grantedPolicies },
    setting: {
      values: {
        "Abp.Localization.DefaultLanguage": "ar",
        "Abp.Timing.TimeZone": "Asia/Baghdad",
      },
    },
    features: { values: {} },
    globalFeatures: { enabledFeatures: [] },
    multiTenancy: { isEnabled: false },
    currentTenant: { id: null, name: null, isAvailable: false },
    timing: { timeZone: { iana: { timeZoneName: "Asia/Baghdad" }, windows: { timeZoneId: "Arabic Standard Time" } } },
    clock: { kind: "Local" },
    objectExtensions: { modules: {}, enums: {} },
    extraProperties: {},
  }
}

/**
 * Slim user profile for the NextAuth server callback. Mirrors what
 * `server.ts → normalizeUserProfile` would extract from the config payload.
 */
export function mockUserProfile() {
  const cfg = mockApplicationConfiguration()
  const user = cfg.currentUser
  return {
    ...user,
    grantedPermissions: Object.keys(cfg.auth.grantedPolicies).filter(k => cfg.auth.grantedPolicies[k]),
    roles: user.roles.map(r => r.toLowerCase()),
  }
}
