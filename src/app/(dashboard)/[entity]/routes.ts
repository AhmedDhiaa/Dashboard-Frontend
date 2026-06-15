/**
 * Unified entity-route registry — slug → entity-config name.
 *
 * Every "simple" entity (one whose routes are exactly list + detail + edit, with
 * no custom sub-pages) is served by ONE dynamic route — `[entity]/page.tsx`,
 * `[entity]/[id]/page.tsx`, `[entity]/[id]/edit/page.tsx` — instead of three
 * hand-written files per entity. This map is the single source of truth that
 * turns the URL slug (e.g. `brands`) into its entity-config name (`brand`).
 *
 * Adding a simple entity is now ONE line here — no new route files.
 *
 * Notes:
 *  - The slug is the plural URL segment; it must match each config's `basePath`
 *    (e.g. `brand.config` sets `basePath: "/brands"`) so list→detail→edit links
 *    resolve back through this dynamic route.
 *  - Static route folders take precedence over this dynamic route in the Next.js
 *    App Router, so an entity that needs a custom page (or extra sub-routes —
 *    orders, employees, finance, reports, …) simply keeps its explicit folder.
 *    `cities/` is intentionally KEPT as the worked example of that escape hatch.
 *  - Unknown slugs resolve to `null` → the dynamic pages call `notFound()` (404).
 */

export const ENTITY_ROUTE_MAP: Readonly<Record<string, string>> = {
  connections: "connection",
  enums: "enum",
  notifications: "notification",
  roles: "role",
  "user-otp": "user-otp",
}

/** Resolve a URL slug to its entity-config name, or `null` if not a known entity. */
export function resolveEntityConfigName(slug: string): string | null {
  return Object.prototype.hasOwnProperty.call(ENTITY_ROUTE_MAP, slug) ? ENTITY_ROUTE_MAP[slug]! : null
}
