"use client"
// Uses useMemo() — must be a Client Component file. The non-hook
// utilities `translateFilterOption` and `countActiveFilters` stay
// in the sibling `filter-utils.ts` (server-importable).

/**
 * Filter Utility Hooks
 *
 * React-hook-shaped wrappers around the pure helpers in
 * `./filter-utils`. Lives in its own file so Server Components can
 * still import the pure utilities without dragging in a client-only
 * import boundary.
 */

import { useMemo } from "react"
import { translateFilterOption } from "./filter-utils"

/**
 * Hook to memoize translated filter options for performance.
 * Prevents unnecessary re-translations on every render.
 *
 * @param options - Array of filter options with value and label
 * @param translateFn - Translation function from useT hook
 * @returns Memoized array of options with translated labels
 *
 * @example
 * const translatedOptions = useMemoizedFilterOptions(field.options, t)
 */
export function useMemoizedFilterOptions(
  options: Array<{ value: string | number; label: string }> | undefined,
  translateFn: (key: string) => string,
): Array<{ value: string | number; label: string; translatedLabel: string }> {
  return useMemo(() => {
    if (!options) return []

    return options.map(option => ({
      ...option,
      translatedLabel: translateFilterOption(option.label, translateFn),
    }))
  }, [options, translateFn])
}
