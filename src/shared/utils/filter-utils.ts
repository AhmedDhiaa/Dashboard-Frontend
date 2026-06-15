/**
 * Filter Utilities — pure, server-importable.
 *
 * Provides helper functions for filter-related operations. The React-hook
 * variants (currently `useMemoizedFilterOptions`) live in the sibling
 * `./filter-utils.hooks` file so this module stays usable from Server
 * Components and shared/agnostic code.
 */

/**
 * Translates a filter option label intelligently.
 * Handles both simple string labels and enum-based translation keys.
 *
 * @param label - The label to translate (can be a simple string or translation key)
 * @param translateFn - Translation function from useT hook
 * @returns Translated label string
 *
 * @example
 * translateFilterOption("Enum:Status:New", t) // Returns "New" or "جديد"
 * translateFilterOption("common.status", t) // Returns translated status
 */
export function translateFilterOption(label: string, translateFn: (key: string) => string): string {
  // If label doesn't contain a colon or dot, it's likely a plain string
  if (!label.includes(":") && !label.includes(".")) {
    return label
  }

  // Try to translate the label as-is first
  try {
    const translated = translateFn(label)
    // If translation returns the same key, it might be missing the Enum prefix
    if (translated === label && label.startsWith("filters:")) {
      // Try again with Enum prefix
      try {
        return translateFn(`Enum:${label}`)
      } catch {
        // Fallback to last part of key
        const parts = label.split(/[:.]/g)
        return parts[parts.length - 1] || label
      }
    }
    return translated
  } catch {
    // If translation fails and it's a filter key, try with Enum prefix
    if (label.startsWith("filters:")) {
      try {
        return translateFn(`Enum:${label}`)
      } catch {
        // Fallback to last part of key
        const parts = label.split(/[:.]/g)
        return parts[parts.length - 1] || label
      }
    }
    // If translation fails, return the last part of the key as fallback
    const parts = label.split(/[:.]/g)
    return parts[parts.length - 1] || label
  }
}

/**
 * Counts active filters (non-empty values).
 *
 * @param filters - Record of filter name to value
 * @returns Number of active filters
 */
export function countActiveFilters(filters: Record<string, unknown>): number {
  return Object.entries(filters).filter(([_, value]) => {
    if (value === undefined || value === null || value === "") return false
    if (typeof value === "string" && !value.trim()) return false
    return true
  }).length
}
