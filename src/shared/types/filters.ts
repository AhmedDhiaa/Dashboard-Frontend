/**
 * Filter Types
 *
 * Shared type definitions for filter functionality
 * Used across UI and Core layers
 */

/**
 * Field configuration for filters
 *
 * @property name - Unique identifier for the filter field (used as query param)
 * @property label - Display label (can be a translation key like "Enum:filters:status_label")
 * @property type - Type of filter input control
 * @property options - Available options for select-type filters (labels can be translation keys)
 * @property placeholder - Placeholder text for input fields (can be a translation key)
 */
export interface FilterField {
  name: string
  label: string
  type: "text" | "select" | "multi-select" | "date" | "daterange" | "number" | "boolean" | "autocomplete"
  options?: Array<{ value: string | number; label: string }>
  enumType?: string // Type of enum to fetch options from
  placeholder?: string
  entityName?: string // Entity name for autocomplete filters
  valueKey?: string // Custom value property for autocomplete (e.g., "code")
  customEndpoint?: string // Custom endpoint for autocomplete
  basePath?: string // Source path for single entity lookup
  direction?: "ltr" | "rtl" // Custom text direction for the field content
  disabled?: boolean // If true, field is read-only and cannot be changed
  required?: boolean // If true, field cannot be cleared/removed
}
