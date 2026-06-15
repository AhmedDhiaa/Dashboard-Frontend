/**
 * Enum Context Provider
 *
 * Global context for managing enum state across the application
 */

"use client"

import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react"
import { logger } from "@/shared/logger"
import { enumService } from "./enum.service"
import type { EnumContextState, EnumCache, EnumTypeName, EnumValue } from "./enum.types"

const EnumContext = createContext<EnumContextState | undefined>(undefined)

interface EnumProviderProps {
  children: React.ReactNode
  preloadEnums?: EnumTypeName[]
}

export function EnumProvider({ children, preloadEnums = ["status"] }: EnumProviderProps) {
  const [cache, setCache] = useState<EnumCache>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, Error | null>>({})

  const loadEnum = useCallback(
    async (enumType: EnumTypeName) => {
      // Skip if already loaded or loading
      if (cache[enumType] || loading[enumType]) return

      setLoading(prev => ({ ...prev, [enumType]: true }))
      setErrors(prev => ({ ...prev, [enumType]: null }))

      try {
        const values = await enumService.getEnumValues(enumType)
        setCache(prev => ({ ...prev, [enumType]: values }))
      } catch (error) {
        logger.error(`[EnumProvider] Failed to load ${enumType}:`, error)
        setErrors(prev => ({ ...prev, [enumType]: error as Error }))
      } finally {
        setLoading(prev => ({ ...prev, [enumType]: false }))
      }
    },
    [cache, loading],
  )

  // Preload enums on mount
  useEffect(() => {
    if (preloadEnums.length > 0) {
      preloadEnums.forEach(enumType => {
        loadEnum(enumType)
      })
    }
  }, [preloadEnums, loadEnum])

  const getEnumValues = useCallback(
    (enumType: EnumTypeName): EnumValue[] => {
      return cache[enumType] || []
    },
    [cache],
  )

  const getEnumValue = useCallback(
    (enumType: EnumTypeName, id: number): EnumValue | undefined => {
      const values = getEnumValues(enumType)
      return values.find(v => v.id === id)
    },
    [getEnumValues],
  )

  const getEnumName = useCallback(
    (enumType: EnumTypeName, id: number, locale: "en" | "ar" = "en"): string => {
      const value = getEnumValue(enumType, id)
      if (!value) return String(id)
      return locale === "ar" ? value.foreignName : value.name
    },
    [getEnumValue],
  )

  const isLoading = useCallback(
    (enumType: EnumTypeName): boolean => {
      return loading[enumType] || false
    },
    [loading],
  )

  const getError = useCallback(
    (enumType: EnumTypeName): Error | null => {
      return errors[enumType] || null
    },
    [errors],
  )

  // Memoize the context value so consumers (mounted app-wide via the dashboard
  // layout) only re-render when enum state actually changes — not on every
  // incidental re-render of this provider. The callbacks are already stable
  // via useCallback; the value identity now changes only with cache/loading/errors.
  const value = useMemo<EnumContextState>(
    () => ({
      cache,
      loading,
      errors,
      loadEnum,
      getEnumValues,
      getEnumValue,
      getEnumName,
      isLoading,
      getError,
    }),
    [cache, loading, errors, loadEnum, getEnumValues, getEnumValue, getEnumName, isLoading, getError],
  )

  return <EnumContext.Provider value={value}>{children}</EnumContext.Provider>
}

/**
 * Hook to access enum context
 */
export function useEnumContext(): EnumContextState {
  const context = useContext(EnumContext)
  if (!context) {
    throw new Error("useEnumContext must be used within EnumProvider")
  }
  return context
}
