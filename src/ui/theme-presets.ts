/**
 * THEME PRESETS - PRODUCTION-GRADE DESIGN SYSTEM
 *
 * Premium theme presets with modern color science using OKLCH.
 * Optimized for accessibility (WCAG 2.1 AA), performance, and visual harmony.
 *
 * @version 2.0.0
 */

import { modernProfessionalTheme } from "./theme-presets/modern-professional"
import { darkElegantTheme } from "./theme-presets/dark-elegant"
import { highContrastTheme } from "./theme-presets/high-contrast"
import { natureInspiredTheme } from "./theme-presets/nature-inspired"
import { midnightPurpleTheme } from "./theme-presets/midnight-purple"
import type { ThemePreset } from "./theme-presets/types"

export type { ThemePreset } from "./theme-presets/types"
export { applyThemePreset } from "./theme-presets/utils"
export { modernProfessionalTheme, darkElegantTheme, highContrastTheme, natureInspiredTheme, midnightPurpleTheme }

// ============================================================================
// THEME PRESET REGISTRY
// ============================================================================

export const themePresets = {
  "modern-professional": modernProfessionalTheme,
  "dark-elegant": darkElegantTheme,
  "high-contrast": highContrastTheme,
  "nature-inspired": natureInspiredTheme,
  "midnight-purple": midnightPurpleTheme,
} as const

export type ThemePresetId = keyof typeof themePresets

/**
 * Get a theme preset by ID
 */
export function getThemePreset(id: ThemePresetId): ThemePreset {
  return themePresets[id]
}

