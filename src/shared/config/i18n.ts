/**
 * Centralized I18n & Locale Management — pure, server-importable surface.
 *
 * The React hooks (`useT`, `useLocale`, `useValidation`, `setTranslationTap`)
 * live in the sibling [`./i18n.hooks`] file so this module stays free of
 * client-only imports. The hooks are re-exported from the bottom of this
 * file for backward compatibility — every existing
 * `from "@/shared/config/i18n"` / `from "@/shared/config"` caller keeps
 * working without an import-path change.
 *
 * @performance Implements caching for locale metadata to minimize re-computations
 * @architecture Single source of truth for all i18n operations
 */

import {
  isValidLocale,
  type Locale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_MAX_AGE,
} from "./locale-constants"

// Re-export locale constants from standalone file to avoid circular dependencies
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_MAX_AGE,
  isValidLocale,
  type Locale,
} from "./locale-constants"

// ============================================================================
// Constants & Types
// ============================================================================

export const LOCALE_STORAGE_KEY = "locale" as const

// ============================================================================
// Translation Keys
// ============================================================================

export const commonI18nKeys = {
  // Actions
  add: "common.add",
  edit: "common.edit",
  delete: "common.delete",
  save: "common.save",
  cancel: "common.cancel",
  back: "common.back",
  create: "common.create",
  update: "common.update",
  search: "common.search",
  filter: "common.filter",
  clearFilter: "common.clearFilter",
  export: "common.export",
  refresh: "common.refresh",
  loading: "common.loading",
  noData: "common.noData",

  // Status
  active: "common.status.active",
  inactive: "common.inactive",
  draft: "common.status.draft",
  published: "common.status.published",

  // Messages
  successCreate: "common.messages.successCreate",
  successUpdate: "common.messages.successUpdate",
  successDelete: "common.messages.successDelete",
  errorCreate: "common.messages.errorCreate",
  errorUpdate: "common.messages.errorUpdate",
  errorDelete: "common.messages.errorDelete",
  errorLoad: "common.messages.errorLoad",
  confirmDelete: "common.messages.confirmDelete",

  // Validation
  required: "common.validation.required",
  invalidEmail: "common.validation.invalidEmail",
  minLength: "common.validation.minLength",
  maxLength: "common.validation.maxLength",
  nameRequired: "common.validation.nameRequired",
  codeRequired: "common.validation.codeRequired",
  titleRequired: "common.validation.titleRequired",
  emailRequired: "common.validation.emailRequired",
  usernameRequired: "common.validation.usernameRequired",
  passwordRequired: "common.validation.passwordRequired",
  phoneRequired: "common.validation.phoneRequired",
  addressRequired: "common.validation.addressRequired",
  descriptionRequired: "common.validation.descriptionRequired",
  mustBeNumber: "common.validation.mustBeNumber",
  mustBePositive: "common.validation.mustBePositive",
  invalidFormat: "common.validation.invalidFormat",

  // CRUD Operations
  creating: "common.creating",
  updating: "common.updating",
  deleting: "common.deleting",
  created: "common.created",
  updated: "common.updated",
  deleted: "common.deleted",
}

/**
 * Helper to generate entity-specific i18n keys
 */
export function entityI18n(entity: string, key: string) {
  return `${entity}.${key}`
}

// ============================================================================
// Validation & Utilities
// ============================================================================

// isValidLocale is already re-exported from locale-constants above

/**
 * Safely coerce a value to a valid locale, falling back to default
 */
export function toValidLocale(value: unknown): Locale {
  return isValidLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * Get locale direction
 */
export function getLocaleDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr"
}

/**
 * Get locale display name
 */
export function getLocaleDisplayName(locale: Locale): string {
  const names: Record<Locale, string> = {
    en: "English",
    ar: "العربية",
  }
  return names[locale]
}

/**
 * Get locale flag emoji
 */
export function getLocaleFlag(locale: Locale): string {
  const flags: Record<Locale, string> = {
    en: "🇬🇧",
    ar: "🇸🇦",
  }
  return flags[locale]
}

// ============================================================================
// State Persistence (Client-Side)
// ============================================================================

/**
 * Read locale from cookie
 */
export function getLocaleFromCookie(): Locale | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split("; ")
  const localeCookie = cookies.find(row => row.startsWith(`${LOCALE_COOKIE_NAME}=`))
  const value = localeCookie?.split("=")[1]
  return isValidLocale(value) ? value : null
}

/**
 * Set locale cookie
 */
export function setLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return
  document.cookie = [
    `${LOCALE_COOKIE_NAME}=${locale}`,
    "path=/",
    `max-age=${LOCALE_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ].join("; ")
}

/**
 * Update document attributes (Client-Side)
 */
export function updateDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = locale
  document.documentElement.dir = getLocaleDirection(locale)
}

/**
 * Unified Locale Persistence
 */
export function persistLocale(locale: Locale): void {
  setLocaleCookie(locale)
  updateDocumentLocale(locale)
}

/**
 * Get current locale from all sources
 */
export function getCurrentLocale(): Locale {
  return getLocaleFromCookie() || DEFAULT_LOCALE
}

// ============================================================================
// Hooks — re-exported from ./i18n.hooks (Client-only)
// ============================================================================

// `export * from "./i18n.hooks"` is intentional: every existing caller
// importing useT/useLocale/useValidation/setTranslationTap from this
// module (whether direct or via the `@/shared/config` barrel) keeps
// working unchanged. The scanner's re-export exclusion permits this.
export * from "./i18n.hooks"
