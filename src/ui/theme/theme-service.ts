/**
 * Theme Persistence Service
 *
 * Manages theme storage separately from auth tokens.
 * Ensures theme preference survives logout/login.
 */

import { logger } from "@/shared/logger"

const THEME_STORAGE_KEY = "app-theme" as const

export type Theme = "light" | "dark" | "system"

export function getSavedTheme(): Theme | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === "light" || saved === "dark" || saved === "system") return saved
    return null
  } catch (error) {
    logger.error("[Theme] Failed to get saved theme", error)
    return null
  }
}

export function saveTheme(theme: Theme): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    logger.debug(`[Theme] Saved: ${theme}`)
  } catch (error) {
    logger.error("[Theme] Failed to save theme", error)
  }
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  } catch (error) {
    logger.error("[Theme] Failed to get system theme", error)
    return "light"
  }
}

export function applyTheme(theme: "light" | "dark"): void {
  if (typeof window === "undefined") return
  try {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
    logger.debug(`[Theme] Applied: ${theme}`)
  } catch (error) {
    logger.error("[Theme] Failed to apply theme", error)
  }
}
