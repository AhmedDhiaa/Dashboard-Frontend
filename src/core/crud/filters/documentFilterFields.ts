/**
 * Shared filter-field builders for document-style ABP list endpoints.
 *
 * ABP sends the FilterField `name` verbatim as the query param, so these
 * names MUST match swagger exactly: DateFrom, DateTo, Term. Mirrors the
 * gold-standard payment.config.tsx pattern.
 */
import type { FilterField } from "@/shared/types/filters"

/** DateFrom / DateTo (ABP report+document date range). */
export const dateFromFilter: FilterField = { name: "DateFrom", label: "Enum:filters:from_date", type: "date" }
export const dateToFilter: FilterField = { name: "DateTo", label: "Enum:filters:to_date", type: "date" }

/** Free-text Term search. */
export function termFilter(placeholder?: string): FilterField {
  return { name: "Term", label: "Enum:filters:search", type: "text", ...(placeholder ? { placeholder } : {}) }
}
