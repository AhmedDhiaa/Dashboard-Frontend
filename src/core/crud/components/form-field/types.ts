import type React from "react"
import type { EntityItem } from "@/core/crud/components/EntityAutocomplete"
import type { EnumTypeName } from "@/core/enums/enum.types"

export interface BaseFieldProps {
  name: string
  label: string
  description?: string
  required?: boolean
}

export interface TextFieldProps extends BaseFieldProps {
  placeholder?: string
  type?: "text" | "email" | "number" | "tel" | "date" | "time" | "datetime-local" | "password" | "url"
  disabled?: boolean
  className?: string
  min?: number | string
  max?: number | string
  step?: number | string
  hideLabel?: boolean
}

export interface TextAreaFieldProps extends BaseFieldProps {
  placeholder?: string
  rows?: number
  disabled?: boolean
  className?: string
  hideLabel?: boolean
}

export interface SwitchFieldProps extends BaseFieldProps {
  disabled?: boolean
  className?: string
  hideLabel?: boolean
}

export interface SelectFieldProps extends BaseFieldProps {
  options: Array<{ value: string | number; label: string }>
  placeholder?: string
  disabled?: boolean
  hideLabel?: boolean
  className?: string
  direction?: "ltr" | "rtl"
}

export interface EntityAutocompleteFieldProps extends BaseFieldProps {
  entityName: string
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  renderSelected?: (item: EntityItem) => React.ReactNode
  renderItem?: (item: EntityItem) => React.ReactNode
  clearable?: boolean
  hideLabel?: boolean
  className?: string
  multiple?: boolean
  valueKey?: string
  customEndpoint?: string
  basePath?: string
}

export interface EnumSelectFieldProps extends BaseFieldProps {
  enumType: EnumTypeName
  placeholder?: string
  disabled?: boolean
  direction?: "ltr" | "rtl"
}

export interface TagsFieldProps extends BaseFieldProps {
  placeholder?: string
  disabled?: boolean
  className?: string
  hideLabel?: boolean
  /** Cap on array length. Unset = no cap. */
  maxCount?: number
  /** When false (default), Enter rejects a duplicate of an existing tag. */
  allowDuplicates?: boolean
}
