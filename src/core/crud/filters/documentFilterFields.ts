/**
 * Shared filter-field builders for document-style ABP list endpoints.
 *
 * ABP sends the FilterField `name` verbatim as the query param, so these
 * names MUST match swagger exactly: DocumentStatus, DocumentType, DateFrom,
 * DateTo, Term, Type, Status, IsHasDriver, IsZero. Mirrors the gold-standard
 * payment.config.tsx pattern.
 */
import type { FilterField } from "@/shared/types/filters"

interface DocumentFilterOptions {
  /** Include DocumentStatus multi-select (enum "status"). Default true. */
  status?: boolean
  /** Include DocumentType multi-select (enum "settlement-method"). Default false. */
  type?: boolean
  /** Include DateFrom/DateTo date fields. Default true. */
  dates?: boolean
  /** Include the free-text Term field. Default true. */
  term?: boolean
  /** Placeholder i18n key for the Term field. */
  termPlaceholder?: string
}

/** DocumentStatus multi-select (ABP `Status` enum). */
export const documentStatusFilter: FilterField = {
  name: "DocumentStatus",
  label: "Enum:filters:status_label",
  type: "multi-select",
  enumType: "status",
}

/** DocumentType multi-select (ABP `SettlementMethod` enum). */
export const documentTypeFilter: FilterField = {
  name: "DocumentType",
  label: "Enum:filters:type_label",
  type: "multi-select",
  enumType: "settlement-method",
}

/** DateFrom / DateTo (ABP report+document date range). */
export const dateFromFilter: FilterField = { name: "DateFrom", label: "Enum:filters:from_date", type: "date" }
export const dateToFilter: FilterField = { name: "DateTo", label: "Enum:filters:to_date", type: "date" }

/** Free-text Term search. */
export function termFilter(placeholder?: string): FilterField {
  return { name: "Term", label: "Enum:filters:search", type: "text", ...(placeholder ? { placeholder } : {}) }
}

/**
 * Compose the standard document filter set. Order: status, type, dates, term.
 * Spread the result into a config's `filterFields`, then add entity-specific
 * fields (e.g. IsHasDriver for Order) before/after as needed.
 */
export function documentFilterFields(opts: DocumentFilterOptions = {}): FilterField[] {
  const { status = true, type = false, dates = true, term = true, termPlaceholder } = opts
  const fields: FilterField[] = []
  if (status) fields.push(documentStatusFilter)
  if (type) fields.push(documentTypeFilter)
  if (dates) fields.push(dateFromFilter, dateToFilter)
  if (term) fields.push(termFilter(termPlaceholder))
  return fields
}
