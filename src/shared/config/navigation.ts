import { LayoutDashboard, MapPin, Blocks, Settings, LifeBuoy, LucideIcon } from "lucide-react"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

/**
 * Navigation Configuration
 *
 * Permission strings match exactly what the API returns for the user after login.
 * The system dynamically shows/hides navigation items based on user's grantedPermissions.
 * No hardcoded permission constants - everything comes from the API based on userId.
 */

export interface NavItem {
  titleKey: string
  href: string
  requiredPermission?: string
  subItems?: readonly NavItem[]
  /** Optional icon for this nav item (rendered in NavItemContent) */
  icon?: LucideIcon
}

export interface NavGroup {
  titleKey: string
  icon: LucideIcon
  requiredPermission?: string
  /** When true, the group is shown only to admins (role-based, via the
   *  session). Used for the no-code Studio surfaces, which self-gate on the
   *  admin role at the page/API level. */
  adminOnly?: boolean
  items: readonly NavItem[]
}

/**
 * Stable group titleKeys, in display order. Exposed as a separate constant
 * (rather than `NAV_GROUPS.map(g => g.titleKey)`) so client modules that
 * only need the group keys can import THIS array without pulling the
 * full lucide-react icon set via the NavGroup definition above.
 *
 * Kept in sync with the NAV_GROUPS array below; the array test in
 * src/shared/config/__tests__ (if any) — or `npm run quality` — will
 * surface drift, and any drift is a localized 1-line edit here.
 */
export const NAV_GROUP_KEYS: readonly string[] = [
  "nav.overview",
  "nav.operations",
  "nav.support",
  "nav.system",
]

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    titleKey: "nav.overview",
    icon: LayoutDashboard,
    items: [
      { titleKey: "nav.dashboard", href: "/", requiredPermission: PERMISSIONS.DASHBOARD_COUNT },
    ],
  },
  {
    // Example CRUD entity — demonstrates the config-driven engine.
    titleKey: "nav.operations",
    icon: MapPin,
    items: [
      { titleKey: "nav.examples", href: "/example", requiredPermission: "Api.Example" },
      // Live fleet map — demonstrates the SignalR realtime layer end-to-end.
      // No permission gate: works for any authenticated user (and in mock mode).
      { titleKey: "nav.tracking", href: "/tracking" },
    ],
  },
  {
    titleKey: "nav.support",
    icon: LifeBuoy,
    requiredPermission: "Api.Ticket",
    items: [
      { titleKey: "nav.tickets", href: "/tickets", requiredPermission: "Api.Ticket" },
    ],
  },
  {
    titleKey: "nav.system",
    icon: Settings,
    items: [
      { titleKey: "nav.users", href: "/users", requiredPermission: "AbpIdentity.Users" },
      { titleKey: "nav.roles", href: "/roles", requiredPermission: "AbpIdentity.Roles" },
      { titleKey: "nav.permissions", href: "/permissions", requiredPermission: "AbpIdentity.Roles" },
      { titleKey: "nav.settings", href: "/system/api-settings" },
      { titleKey: "nav.notifications", href: "/notifications", requiredPermission: "Api.Notification" },
    ],
  },
  {
    // Developer Tools — every no-code builder + the Git bridge + the unified
    // component showcase ("All") in ONE admin-only group. The showcase
    // sub-pages are intentionally not listed here: "All" already mounts every
    // component on one page. The Git bridge (source-writing) self-gates to dev
    // at the route level; the builders are prod-safe (read-time overrides).
    titleKey: "nav.dev_mode",
    icon: Blocks,
    adminOnly: true,
    items: [
      { titleKey: "nav.studio_builder", href: "/builder" },
      { titleKey: "nav.studio_entities", href: "/admin/entities" },
      { titleKey: "nav.studio_pages", href: "/admin/page-builder" },
      { titleKey: "nav.studio_widgets", href: "/admin/widget-builder" },
      { titleKey: "nav.studio_translations", href: "/admin/translations" },
      { titleKey: "nav.studio_theme", href: "/admin/theme" },
      { titleKey: "nav.studio_git", href: "/admin/git" },
      { titleKey: "nav.showcase_all", href: "/showcase/all" },
    ],
  },
] as const
