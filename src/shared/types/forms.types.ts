/**
 * Form and Validation Types
 * Defines form schemas, validation rules, and error handling
 */

export type FormFieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "radio"
  | "textarea"
  | "file"
  | "switch"
  | "datepicker"

export interface FormFieldOption {
  label: string
  value: string | number
  disabled?: boolean
  icon?: string
}

export interface FormValidationRule {
  type: "required" | "email" | "minLength" | "maxLength" | "min" | "max" | "pattern" | "custom"
  message: string
  value?: string | number | RegExp
  validate?: (value: unknown) => boolean | string
}

export interface FormField {
  name: string
  label: string
  type: FormFieldType
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hidden?: boolean
  value?: unknown
  defaultValue?: unknown
  options?: FormFieldOption[]
  validation?: FormValidationRule[]
  helperText?: string
  icon?: string
  className?: string
  // File upload specific
  accept?: string
  maxSize?: number // in bytes
  // Field groups
  group?: string
  // Conditional visibility
  visibleWhen?: (values: Record<string, unknown>) => boolean
  // Custom rendering
  render?: (field: FormField, value: unknown, onChange: (value: unknown) => void) => React.ReactNode
}

export interface ValidationError {
  field: string
  message: string
  code?: string
  value?: unknown
}
