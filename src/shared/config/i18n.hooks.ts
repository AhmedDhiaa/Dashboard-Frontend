"use client"
// Client-only hooks lifted out of ./i18n so that file stays
// importable from Server Components. The original `i18n.ts`
// re-exports everything here for backward compatibility, so
// existing callers don't need an import-path change.

/**
 * I18n React Hooks
 *
 * `useT`, `useLocale`, `useValidation` — the client-side surface of
 * the i18n module. Lives in its own file so the surrounding pure
 * helpers (constants, plain functions) in `./i18n` can stay usable
 * from Server Components and shared/agnostic code.
 */

import { useTranslations, useLocale as useNextLocale } from "next-intl"
import { useCallback } from "react"
import type { Locale } from "./locale-constants"
import { getLocaleDisplayName, getLocaleFlag } from "./i18n"

// ─── Translation tap ──────────────────────────────────────────────────────────
//
// The translation editor (src/features/admin-tools/translation-editor) needs
// to observe every `t()` call to build an index of (namespace, key) → rendered
// text so it can map a hovered DOM node back to the source key. The editor
// lives in `features/`; `shared/` cannot import from `features/`. This module
// exposes a single mutable callback the editor registers on mount and clears
// on unmount — a one-line dependency-inversion port.

type TranslationTap = (namespace: string | undefined, key: string, result: string) => void
let translationTap: TranslationTap | null = null

export function setTranslationTap(fn: TranslationTap | null): void {
  translationTap = fn
}

// ─── Internal helpers (used only by useT below) ──────────────────────────────

/**
 * Resolves a display value from a potentially complex translation object.
 * Handles the name/foreignName/title pattern.
 */
function resolveDisplayValue(value: unknown, locale: string): string | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as Record<string, any>
    // Prioritize foreignName for non-Arabic locales, otherwise use name
    return (locale !== "ar" ? obj.foreignName : obj.name) || obj.name || obj.title
  }
  return undefined
}

/**
 * Handles translation fallback logic.
 */
function handleTranslationFallback(normalizedKey: string): string {
  // Log missing translation for debugging
  console.warn(`[i18n] Missing translation for key: "${normalizedKey}" (using fallback)`)

  // If translation fails (e.g., INSUFFICIENT_PATH error), return a readable fallback
  // Convert the key to a human-readable format
  const parts = normalizedKey.split(".")
  const lastPart = parts[parts.length - 1]

  if (!lastPart) {
    return normalizedKey
  }

  return formatKeyAsFallback(normalizedKey)
}

// Helper function to format a key as a readable fallback
function formatKeyAsFallback(key: string): string {
  const parts = key.split(".")
  const lastPart = parts[parts.length - 1]

  if (!lastPart) {
    return key
  }

  return lastPart
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
    .trim()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Enhanced translation hook (Primary i18n interface)
 *
 * Proxies next-intl's useTranslations to provide a consistent, simplified API.
 * Use this instead of importing useTranslations directly from next-intl.
 *
 * @param namespace - Optional namespace for scoped translations (e.g., "common", "forms")
 * @returns Translation function that accepts keys and optional parameters
 *
 * @example
 * ```tsx
 * const t = useT()
 * return <h1>{t("common.welcome")}</h1>
 *
 * // With namespace
 * const t = useT("forms")
 * return <label>{t("email")}</label>
 * ```
 */
export function useT(namespace?: string) {
  const translate = useTranslations(namespace)
  const locale = useNextLocale()

  // Return a memoized custom translation function
  // Translation args - dynamic parameters from next-intl, type varies per translation key
  return useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Translation parameters are dynamic
    (key: string, ...args: any[]): string => {
      // If key contains colon, replace ALL colons with dots for next-intl
      const normalizedKey = key.replaceAll(":", ".")

      try {
        // First try to get the raw value to check if it's an object with name/foreignName
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawResult = (translate as any).raw?.(normalizedKey)

        // If raw result is an object with name/foreignName, resolve it
        if (rawResult && typeof rawResult === "object" && !Array.isArray(rawResult)) {
          const displayValue = resolveDisplayValue(rawResult, locale)
          if (displayValue) return displayValue
        }

        // Otherwise use normal translation (which handles parameters)
        const result = translate(normalizedKey, ...args)

        // If result is an object, try to get a display name
        const resultDisplay = resolveDisplayValue(result, locale)
        if (resultDisplay) {
          translationTap?.(namespace, normalizedKey, resultDisplay)
          return resultDisplay
        }

        translationTap?.(namespace, normalizedKey, result as string)
        return result as string
      } catch (error) {
        // Log for debugging
        console.warn(`[i18n] Translation failed for key: "${normalizedKey}"`, error)
        return handleTranslationFallback(normalizedKey)
      }
    },
    // `namespace` is captured by the inner closure for the translationTap
    // call — include it in deps so the callback rebinds when it changes.
    [translate, locale, namespace],
  )
}

/**
 * Enhanced locale hook with rich metadata
 *
 * Returns comprehensive locale information including direction, RTL status,
 * display names, flags, and utility functions for direction-aware styling.
 */
export function useLocale() {
  const locale = useNextLocale() as Locale
  const isRTL = locale === "ar"
  return {
    locale,
    direction: isRTL ? "rtl" : "ltr",
    isRTL,
    displayName: getLocaleDisplayName(locale),
    flag: getLocaleFlag(locale),
    start: isRTL ? "right" : "left",
    end: isRTL ? "left" : "right",
    dir: <T>(ltr: T, rtl: T): T => (isRTL ? rtl : ltr),
  }
}

/**
 * Enhanced validation hook for form validation messages
 *
 * Provides translation-aware validation message helpers that work
 * seamlessly with react-hook-form and Zod schemas.
 */
export function useValidation() {
  const t = useT("common.validation")

  return {
    required: (field?: string) => (field ? `${field} ${t("required")}` : t("required")),
    email: () => t("invalidEmail"),
    minLength: (min: number) => `${t("minLength")} ${min}`,
    maxLength: (max: number) => `${t("maxLength")} ${max}`,
    mustBeNumber: () => t("mustBeNumber"),
    mustBePositive: () => t("mustBePositive"),
    invalidFormat: () => t("invalidFormat"),
    nameRequired: () => t("nameRequired"),
    codeRequired: () => t("codeRequired"),
    titleRequired: () => t("titleRequired"),
    emailRequired: () => t("emailRequired"),
    usernameRequired: () => t("usernameRequired"),
    passwordRequired: () => t("passwordRequired"),
    phoneRequired: () => t("phoneRequired"),
    addressRequired: () => t("addressRequired"),
    descriptionRequired: () => t("descriptionRequired"),
  }
}
