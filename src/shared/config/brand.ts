/**
 * Brand / white-label configuration — the single source of truth for the
 * product name and primary domain.
 *
 * This platform ships as a neutral, white-label template. Everything that used
 * to hardcode a specific product name or domain now reads from here, so a
 * deployer rebrands the whole app by setting two environment variables — no
 * code changes, no find-and-replace.
 *
 *   NEXT_PUBLIC_APP_NAME      → display name shown in the UI, titles, emails.
 *   NEXT_PUBLIC_BRAND_DOMAIN  → primary domain used for demo emails, image
 *                               allow-lists, and documentation examples.
 *
 * Both are `NEXT_PUBLIC_` so they're available in client components and inlined
 * at build time. Defaults are intentionally generic placeholders ("Acme" /
 * "example.com") that read naturally in copy and signal "replace me".
 */

/** Display name of the product (UI, page titles, transactional copy). */
export const APP_NAME: string = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Acme"

/** Primary brand domain (demo emails, image allow-list, doc examples). */
export const BRAND_DOMAIN: string = process.env.NEXT_PUBLIC_BRAND_DOMAIN?.trim() || "example.com"

/** Convenience grouping for callers that want the whole brand at once. */
export const BRAND = {
  name: APP_NAME,
  domain: BRAND_DOMAIN,
} as const

export type Brand = typeof BRAND
