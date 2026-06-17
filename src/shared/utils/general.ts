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
 * Latin slug → kebab id. Runs of non-alphanumeric chars collapse to a single
 * hyphen; leading/trailing hyphens are stripped. Returns "" when the input has
 * no usable ASCII (e.g. Arabic-only), so callers can prompt for an explicit id.
 * Pass `maxLength` to cap the result (e.g. a column/id length limit).
 */
export function slugify(input: string, maxLength?: number): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return maxLength ? slug.slice(0, maxLength) : slug
}

/**
 * Resolve after `ms` milliseconds. Handy for retry back-off delays.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Read a value from a nested object by a dot-path (e.g. "a.b.c"). Returns
 * undefined for a missing segment, a non-object root, or a path that tries to
 * descend into an array. Single source for excel export + detail rendering.
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined
  if (!path.includes(".")) return (obj as Record<string, unknown>)[path]
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc) && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
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
