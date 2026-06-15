/**
 * Application Configuration Types
 *
 * Type definitions for the ABP application configuration endpoint
 * GET /api/abp/application-configuration
 */

export interface CurrentUser {
  isAuthenticated: boolean
  id: string | null
  tenantId: string | null
  impersonatorUserId: string | null
  impersonatorTenantId: string | null
  impersonatorUserName: string | null
  impersonatorTenantName: string | null
  userName: string | null
  name: string | null
  surName: string | null
  email: string | null
  emailVerified: boolean
  phoneNumber: string | null
  phoneNumberVerified: boolean
  roles: string[]
  sessionId: string | null
}

export interface Features {
  values: Record<string, string>
}

export interface GlobalFeatures {
  enabledFeatures: string[]
}

export interface MultiTenancy {
  isEnabled: boolean
}

export interface CurrentTenant {
  id: string | null
  name: string | null
  isAvailable: boolean
}

export interface TimeZoneInfo {
  iana: {
    timeZoneName: string | null
  }
  windows: {
    timeZoneId: string | null
  }
}

export interface Timing {
  timeZone: TimeZoneInfo
}

export interface Clock {
  kind: "Unspecified" | "Utc" | "Local"
}

export interface ObjectExtensions {
  modules: Record<string, unknown>
  enums: Record<string, unknown>
}

export interface AuthConfig {
  grantedPolicies: Record<string, boolean>
  policies?: Record<string, boolean>
}

export interface SettingConfig {
  values: Record<string, string>
}

export interface ApplicationConfiguration {
  currentUser: CurrentUser
  auth: AuthConfig
  setting: SettingConfig
  features: Features
  globalFeatures: GlobalFeatures
  multiTenancy: MultiTenancy
  currentTenant: CurrentTenant
  timing: Timing
  clock: Clock
  objectExtensions: ObjectExtensions
  extraProperties: Record<string, unknown>
}
