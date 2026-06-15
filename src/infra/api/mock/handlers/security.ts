/**
 * Mock handler for ABP permission-management + application settings.
 *
 * Backs two surfaces that talk to non-`/api/app` endpoints (so the generic
 * CRUD handler can't serve them):
 *   • the PermissionButton dialog opened from Users / Roles rows
 *       GET|PUT /api/permission-management/permissions
 *   • the API Settings page
 *       GET|PUT /api/app/api-setting   → raw ApiSetting[]
 *
 * Data is deterministic so the demo looks identical on every load.
 */

import type { GetPermissionsResponse, ApiSetting } from "@/shared/types/security.types"

// ── Permissions ─────────────────────────────────────────────────────────────

interface PermSeed {
  name: string
  displayName: string
  parentName?: string
}

const PERMISSION_GROUPS: ReadonlyArray<{ name: string; displayName: string; perms: PermSeed[] }> = [
  {
    name: "AbpIdentity",
    displayName: "Identity Management",
    perms: [
      { name: "AbpIdentity.Roles", displayName: "Role management" },
      { name: "AbpIdentity.Roles.Create", displayName: "Create", parentName: "AbpIdentity.Roles" },
      { name: "AbpIdentity.Roles.Update", displayName: "Edit", parentName: "AbpIdentity.Roles" },
      { name: "AbpIdentity.Roles.Delete", displayName: "Delete", parentName: "AbpIdentity.Roles" },
      { name: "AbpIdentity.Users", displayName: "User management" },
      { name: "AbpIdentity.Users.Create", displayName: "Create", parentName: "AbpIdentity.Users" },
      { name: "AbpIdentity.Users.Update", displayName: "Edit", parentName: "AbpIdentity.Users" },
      { name: "AbpIdentity.Users.Delete", displayName: "Delete", parentName: "AbpIdentity.Users" },
      {
        name: "AbpIdentity.Users.ManagePermissions",
        displayName: "Manage permissions",
        parentName: "AbpIdentity.Users",
      },
    ],
  },
  {
    name: "Api",
    displayName: "Application",
    perms: [
      { name: "Api.Example", displayName: "Example UI" },
      { name: "Api.Example.Create", displayName: "Create", parentName: "Api.Example" },
      { name: "Api.Example.Edit", displayName: "Edit", parentName: "Api.Example" },
      { name: "Api.Example.Delete", displayName: "Delete", parentName: "Api.Example" },
      { name: "Api.Tickets", displayName: "Support tickets" },
      { name: "Api.Tickets.Create", displayName: "Create", parentName: "Api.Tickets" },
      { name: "Api.Tickets.Resolve", displayName: "Resolve", parentName: "Api.Tickets" },
    ],
  },
]

/** Build a GetPermissionsResponse for the requested provider (all but *.Delete granted). */
export function permissionsResponse(params: Record<string, unknown>): GetPermissionsResponse {
  const providerName = String(params.providerName ?? params.ProviderName ?? "R")
  const providerKey = String(params.providerKey ?? params.ProviderKey ?? "")
  return {
    entityDisplayName: providerKey || providerName,
    groups: PERMISSION_GROUPS.map(g => ({
      name: g.name,
      displayName: g.displayName,
      displayNameKey: null,
      displayNameResource: null,
      permissions: g.perms.map(p => {
        const isGranted = !p.name.endsWith(".Delete")
        return {
          name: p.name,
          displayName: p.displayName,
          parentName: p.parentName,
          isGranted,
          allowedProviders: ["R", "U"],
          grantedProviders: isGranted ? [{ providerName, providerKey }] : [],
        }
      }),
    })),
  }
}

// ── Application settings ──────────────────────────────────────────────────────

// Names use ABP prefixes so the settings page groups them (see SETTING_GROUPS).
const API_SETTINGS: ReadonlyArray<{ name: string; value: string }> = [
  { name: "Abp.Localization.DefaultLanguage", value: "en" },
  { name: "Abp.Timing.TimeZone", value: "UTC" },
  { name: "Abp.Mailing.DefaultFromAddress", value: "no-reply@example.com" },
  { name: "Abp.Mailing.DefaultFromDisplayName", value: "Acme Platform" },
  { name: "Abp.Mailing.Smtp.Host", value: "smtp.example.com" },
  { name: "Abp.Mailing.Smtp.Port", value: "587" },
  { name: "Abp.Mailing.Smtp.EnableSsl", value: "true" },
  { name: "Abp.Mailing.Smtp.UserName", value: "mailer@example.com" },
  { name: "Abp.Identity.Password.RequiredLength", value: "8" },
  { name: "Abp.Identity.Password.RequireDigit", value: "true" },
  { name: "Abp.Identity.Password.RequireUppercase", value: "true" },
  { name: "Abp.Identity.Password.RequireNonAlphanumeric", value: "false" },
  { name: "Abp.Identity.Lockout.MaxFailedAccessAttempts", value: "5" },
  { name: "Abp.Identity.Lockout.LockoutDuration", value: "300" },
  { name: "Abp.Identity.SignIn.RequireConfirmedEmail", value: "false" },
  { name: "Abp.Identity.User.IsUserNameUpdateEnabled", value: "true" },
  { name: "Abp.Account.IsSelfRegistrationEnabled", value: "false" },
  { name: "Api.System.SupportEmail", value: "support@example.com" },
  { name: "Api.System.PortalUrl", value: "https://portal.example.com" },
  { name: "Api.System.MaintenanceMode", value: "false" },
]

/** Return the global application settings as a raw array (ABP api-setting shape). */
export function apiSettingsResponse(): ApiSetting[] {
  return API_SETTINGS.map(s => ({ ...s, providerName: "G", providerKey: "" }))
}
