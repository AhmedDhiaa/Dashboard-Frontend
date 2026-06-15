/**
 * Enum Hooks
 *
 * React hooks for easy enum usage in components
 */

import { useEffect } from "react"
import { useEnumContext } from "./EnumProvider"
import type { EnumTypeName } from "./enum.types"
import { useT, useLocale } from "@/shared/config"

/**
 * Hook to get all values for an enum type
 */
export function useEnum(enumType: EnumTypeName) {
  const { getEnumValues, isLoading, getError, loadEnum, cache } = useEnumContext()

  useEffect(() => {
    if (enumType && !cache[enumType]) {
      loadEnum(enumType)
    }
  }, [enumType, cache, loadEnum])

  const values = enumType ? getEnumValues(enumType) : []
  const loading = enumType ? isLoading(enumType) : false

  return {
    values,
    loading,
    error: enumType ? getError(enumType) : null,
  }
}

/**
 * Hook to get a specific enum value by ID
 */
export function useEnumValue(enumType: EnumTypeName, id: number | null | undefined) {
  const { getEnumValue, isLoading, getError } = useEnumContext()

  if (id === null || id === undefined) {
    return {
      value: undefined,
      loading: false,
      error: null,
    }
  }

  return {
    value: getEnumValue(enumType, id),
    loading: isLoading(enumType),
    error: getError(enumType),
  }
}

/**
 * Hook to get enum display name by ID
 */
export function useEnumName(enumType: EnumTypeName, id: number | null | undefined) {
  const { value, loading, error } = useEnumValue(enumType, id)
  const t = useT()
  const { locale } = useLocale()

  if (id === null || id === undefined || !value) {
    return {
      name: id === null || id === undefined ? "-" : String(id),
      loading,
      error,
    }
  }

  const displayName = value.localization?.name
    ? t(value.localization.name)
    : (locale === "ar" ? value.name : value.foreignName) || value.name

  return {
    name: displayName,
    loading,
    error,
  }
}

/**
 * Hook to get enum options for select/dropdown
 */
export function useEnumOptions(enumType: EnumTypeName | undefined) {
  const { values, loading, error } = useEnum(enumType as EnumTypeName)
  const t = useT()
  const { locale } = useLocale()

  const options = values?.map(value => ({
    value: value.id,
    label: value.localization?.name
      ? t(value.localization.name)
      : (locale === "ar" ? value.name : value.foreignName) || value.name,
  }))

  return {
    options,
    loading,
    error,
  }
}
