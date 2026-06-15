/**
 * Shared Navigation Utilities
 *
 * Single source of truth for navigation primitives used across the app.
 * Re-exports from next-intl navigation so all consumers import from one place.
 * If next-intl's API changes, only this file needs updating.
 *
 * Usage:
 *   import { useRouter, usePathname, Link, redirect } from "@/shared/config/routes"
 */

export { Link, redirect, usePathname, useRouter } from "@/i18n/navigation"
