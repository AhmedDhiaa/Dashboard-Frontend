/**
 * i18n Navigation Configuration
 * Provides type-safe routing for next-intl
 * Locale is determined from cookies, not URL
 */

import { createNavigation } from "next-intl/navigation"
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/shared/config/locale-constants"

export const locales = [...SUPPORTED_LOCALES]
export const defaultLocale = DEFAULT_LOCALE

export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales,
  defaultLocale,
  localePrefix: "never", // Never add locale to URL paths
})
