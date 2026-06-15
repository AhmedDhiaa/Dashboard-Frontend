/**
 * Utility Functions Library
 * Common utilities for the application
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T
  if (obj instanceof Object) {
    const cloned = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }
  return obj
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
        result[key] = deepMerge(
          (targetValue && typeof targetValue === "object" ? targetValue : {}) as Record<string, unknown>,
          sourceValue as Record<string, unknown>,
        ) as T[Extract<keyof T, string>]
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>]
      }
    }
  }

  return result
}

/**
 * Format a date to ISO string without time
 */
export function formatDateISO(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toISOString().split("T")[0] ?? ""
}

/**
 * Flatten nested array
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.reduce<T[]>((acc, item) => {
    if (Array.isArray(item)) {
      acc.push(...flatten(item))
    } else {
      acc.push(item)
    }
    return acc
  }, [])
}

/**
 * Check if a path is active (exact match or parent of current path)
 * Handles locale prefixes (e.g., /ar/receives matching /receives)
 */
export function isPathActive(pathname: string, targetPath: string): boolean {
  if (!pathname || !targetPath) return false

  // Normalize paths by removing locale prefixes (e.g., /en/, /ar/)
  const cleanPathname = pathname.replace(/^\/(en|ar)(\/|$)/, "/")
  const cleanTarget = targetPath.replace(/^\/(en|ar)(\/|$)/, "/")

  if (cleanPathname === cleanTarget) return true

  // Handle nested paths (e.g., /receives matching /receives/123)
  if (cleanTarget !== "/" && cleanPathname.startsWith(cleanTarget)) {
    const nextChar = cleanPathname[cleanTarget.length]
    return nextChar === "/" || nextChar === "?" || nextChar === "#" || nextChar === undefined
  }

  return false
}
