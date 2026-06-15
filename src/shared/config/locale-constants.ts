/**
 * Locale Constants
 *
 * Standalone file to avoid circular dependencies
 */

export const SUPPORTED_LOCALES = ["en", "ar"] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "ar"

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE"
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 year in seconds

export function isValidLocale(locale: unknown): locale is Locale {
  return typeof locale === "string" && SUPPORTED_LOCALES.includes(locale as Locale)
}
