"use client"

import { useEnumOptions } from "@/core/enums"
import { useT } from "@/shared/config"
import { SelectField } from "./SelectField"
import type { EnumSelectFieldProps } from "./types"

/**
 * Field that automatically loads and displays enum values from the enum system
 */
export function EnumSelectField({
  name,
  label,
  description,
  enumType,
  placeholder,
  required,
  disabled,
  direction,
}: EnumSelectFieldProps) {
  const { options, loading } = useEnumOptions(enumType)
  const t = useT()

  return (
    <SelectField
      name={name}
      label={label}
      description={description}
      options={options || []}
      placeholder={loading ? t("common.loading") : placeholder}
      required={required}
      disabled={disabled || loading}
      direction={direction}
    />
  )
}
