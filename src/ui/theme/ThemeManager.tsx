"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { logger } from "@/shared/logger"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"
import { type ThemePresetId, getThemePreset, applyThemePreset, themePresets } from "../theme-presets"

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeVersion {
  id: string
  timestamp: string
  name: string
  settings: ThemeSettings
}

export interface ThemeSettings {
  // Theme preset selection
  activePreset: ThemePresetId

  // Brand & Semantic Colors
  accentColor: string
  secondaryColor: string
  successColor: string
  warningColor: string
  infoColor: string
  mutedColor: string

  // Aesthetics
  radius: number
  glassmorphism: boolean
  glassIntensity: number
  shadowStrength: number

  // Layout & Scaling
  spacingUnit: number
  fontScale: number
  headerHeight: number
  sidebarWidth: number
  maxContentWidth: number

  // Animations
  animationScale: number

  // Reduced motion preference
  reducedMotion: boolean

  // Component-specific styles (Power Designer Mode)
  components: Record<
    string,
    {
      elements: Record<
        string,
        {
          styles: Record<string, string | number>
          classes: string[]
        }
      >
    }
  >

  // Legacy support (will be migrated)
  componentStyles: Record<string, Record<string, string | number>>
}

export interface ThemeContextType {
  theme: string | undefined
  settings: ThemeSettings
  activePreset: ThemePresetId
  isInitialized: boolean
  isDirty: boolean
  versions: ThemeVersion[]
  setTheme: (theme: string) => void
  setActivePreset: (presetId: ThemePresetId) => void
  updateSettings: (settings: Partial<ThemeSettings>) => void
  updateComponentStyle: (componentId: string, property: string, value: string | number, elementId?: string) => void
  updateComponentClasses: (componentId: string, elementId: string, classes: string[]) => void
  resetComponentStyle: (componentId: string, elementId?: string) => void
  resetAllComponents: () => void
  resetToDefaults: () => void
  resetToPreset: (presetId: ThemePresetId) => void
  publishTheme: () => Promise<void>
  rollbackToVersion: (versionId: string) => void
  exportSettings: () => string
  importSettings: (json: string) => boolean
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: ThemeSettings = {
  activePreset: "modern-professional",
  accentColor: "oklch(0.55 0.12 220)",
  secondaryColor: "oklch(0.72 0.12 80)",
  successColor: "oklch(0.62 0.17 145)",
  warningColor: "oklch(0.75 0.15 75)",
  infoColor: "oklch(0.60 0.14 250)",
  mutedColor: "oklch(0.96 0.005 240)",

  // Sleek/Linear-style defaults: crisper 8px radius (was 12px), flatter
  // shadows and lighter glass for a minimal, "quiet" surface treatment.
  radius: 0.5,
  glassmorphism: true,
  glassIntensity: 0.09,
  shadowStrength: 0.05,

  spacingUnit: 1,
  fontScale: 1,
  headerHeight: 4,
  sidebarWidth: 16,
  maxContentWidth: 80,

  animationScale: 1,
  reducedMotion: false,

  components: {},
  componentStyles: {},
}

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEY = "design-system-settings-v2"

// ============================================================================
// INTERNAL HOOKS
// ============================================================================

function useThemeActions(
  setSettings: React.Dispatch<React.SetStateAction<ThemeSettings>>,
  setIsDirty: (v: boolean) => void,
) {
  const updateSettings = useCallback(
    (s: Partial<ThemeSettings>) => {
      setSettings(prev => ({ ...prev, ...s }))
      setIsDirty(true)
    },
    [setSettings, setIsDirty],
  )

  const updateComponentStyle = useCallback(
    (componentId: string, property: string, value: string | number, elementId?: string) => {
      setSettings(prev => {
        setIsDirty(true)
        if (elementId) {
          const config = prev.components[componentId] || { elements: {} }
          const element = config.elements[elementId] || { styles: {}, classes: [] }
          return {
            ...prev,
            components: {
              ...prev.components,
              [componentId]: {
                ...config,
                elements: {
                  ...config.elements,
                  [elementId]: { ...element, styles: { ...element.styles, [property]: value } },
                },
              },
            },
          }
        }
        return {
          ...prev,
          componentStyles: {
            ...prev.componentStyles,
            [componentId]: { ...prev.componentStyles[componentId], [property]: value },
          },
        }
      })
      applyImmediateComponentStyle(componentId, property, value, elementId)
    },
    [setSettings, setIsDirty],
  )

  const updateComponentClasses = useCallback(
    (componentId: string, elementId: string, classes: string[]) => {
      setSettings(prev => {
        const config = prev.components[componentId] || { elements: {} }
        const element = config.elements[elementId] || { styles: {}, classes: [] }
        return {
          ...prev,
          components: {
            ...prev.components,
            [componentId]: {
              ...config,
              elements: {
                ...config.elements,
                [elementId]: { ...element, classes },
              },
            },
          },
        }
      })
    },
    [setSettings],
  )

  const resetComponentStyle = useCallback(
    (componentId: string, elementId?: string) => {
      setSettings(prev => {
        if (elementId) {
          const config = prev.components[componentId]
          if (!config || !config.elements[elementId]) return prev
          const newElements = { ...config.elements }
          delete newElements[elementId]
          return {
            ...prev,
            components: {
              ...prev.components,
              [componentId]: { ...config, elements: newElements },
            },
          }
        }
        const newStyles = { ...prev.componentStyles }
        delete newStyles[componentId]
        return { ...prev, componentStyles: newStyles }
      })
    },
    [setSettings],
  )

  return { updateSettings, updateComponentStyle, updateComponentClasses, resetComponentStyle }
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

function ThemeProviderInner({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useNextTheme()
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS)
  const [activePreset, setActivePresetState] = useState<ThemePresetId>("modern-professional")
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [versions, setVersions] = useState<ThemeVersion[]>([])

  // Initialization & Effects
  useThemeInitialization(setSettings, setActivePresetState, setIsInitialized, setVersions)
  useThemeVariableApplier(settings, isInitialized)

  // Actions
  const { updateSettings, updateComponentStyle, updateComponentClasses, resetComponentStyle } = useThemeActions(
    setSettings,
    setIsDirty,
  )

  const resetAllComponents = useCallback(() => {
    setSettings(prev => ({ ...prev, componentStyles: {} }))
  }, [])

  const setActivePreset = useCallback((presetId: ThemePresetId) => {
    const preset = getThemePreset(presetId)
    applyThemePreset(preset)
    setSettings({
      activePreset: presetId,
      accentColor: preset.colors.primary,
      secondaryColor: preset.colors.secondary,
      successColor: preset.colors.success,
      warningColor: preset.colors.warning,
      infoColor: preset.colors.info,
      mutedColor: preset.colors.muted,
      radius: preset.aesthetics.radius,
      glassmorphism: preset.aesthetics.glassIntensity > 0,
      glassIntensity: preset.aesthetics.glassIntensity,
      shadowStrength: preset.aesthetics.shadowStrength,
      spacingUnit: preset.layout.spacingUnit,
      fontScale: preset.layout.fontScale,
      headerHeight: preset.layout.headerHeight,
      sidebarWidth: preset.layout.sidebarWidth,
      maxContentWidth: preset.layout.maxContentWidth,
      animationScale: preset.motion.animationScale,
      reducedMotion: false,
      components: {},
      componentStyles: {},
    })
    setActivePresetState(presetId)
  }, [])

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    setActivePresetState("modern-professional")
  }, [])

  const publishTheme = useCallback(async () => {
    const newVersion: ThemeVersion = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      name: `Version ${versions.length + 1}`,
      settings: { ...settings },
    }

    const newVersions = [newVersion, ...versions].slice(0, 50)
    setVersions(newVersions)
    setIsDirty(false)

    localStorage.setItem(`${STORAGE_KEY}-versions`, JSON.stringify(newVersions))
    localStorage.setItem(`${STORAGE_KEY}-published`, JSON.stringify(settings))
  }, [settings, versions])

  const rollbackToVersion = useCallback(
    (versionId: string) => {
      const version = versions.find(v => v.id === versionId)
      if (version) {
        setSettings(version.settings)
        setIsDirty(false)
      }
    },
    [versions],
  )

  const exportSettings = useCallback(
    () => JSON.stringify({ settings, activePreset, version: "2.1.0", exportedAt: new Date().toISOString() }, null, 2),
    [settings, activePreset],
  )

  const importSettings = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json)
      if (data.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
        if (data.activePreset && themePresets[data.activePreset as ThemePresetId])
          setActivePresetState(data.activePreset)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      theme,
      settings,
      activePreset,
      isInitialized,
      isDirty,
      versions,
      setTheme,
      setActivePreset,
      updateSettings,
      updateComponentStyle,
      updateComponentClasses,
      resetComponentStyle,
      resetAllComponents,
      resetToDefaults,
      resetToPreset: setActivePreset,
      publishTheme,
      rollbackToVersion,
      exportSettings,
      importSettings,
    }),
    [
      theme,
      settings,
      activePreset,
      isInitialized,
      isDirty,
      versions,
      setTheme,
      setActivePreset,
      updateSettings,
      updateComponentStyle,
      updateComponentClasses,
      resetComponentStyle,
      resetAllComponents,
      resetToDefaults,
      publishTheme,
      rollbackToVersion,
      exportSettings,
      importSettings,
    ],
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

function useThemeInitialization(
  setSettings: (s: ThemeSettings) => void,
  setActivePreset: (p: ThemePresetId) => void,
  setIsInitialized: (i: boolean) => void,
  setVersions: (v: ThemeVersion[]) => void,
) {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setSettings({ ...DEFAULT_SETTINGS, reducedMotion: e.matches })
    mediaQuery.addEventListener("change", handleChange)

    requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          setSettings({ ...DEFAULT_SETTINGS, ...parsed })
          if (parsed.activePreset && themePresets[parsed.activePreset as ThemePresetId])
            setActivePreset(parsed.activePreset)
        }

        const savedVersions = localStorage.getItem(`${STORAGE_KEY}-versions`)
        if (savedVersions) {
          setVersions(JSON.parse(savedVersions))
        }
      } catch (e) {
        logger.error("Failed to parse theme settings", e)
      } finally {
        setIsInitialized(true)
      }
    })
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [setActivePreset, setIsInitialized, setSettings, setVersions])
}

function useThemeVariableApplier(settings: ThemeSettings, isInitialized: boolean) {
  useEffect(() => {
    if (!isInitialized) return
    const apply = () => {
      const root = document.documentElement
      const updates: [string, string][] = [
        ["--primary", settings.accentColor],
        ["--secondary", settings.secondaryColor],
        ["--success", settings.successColor],
        ["--warning", settings.warningColor],
        ["--info", settings.infoColor],
        // NOTE: --muted is deliberately NOT applied inline. It's a neutral that
        // must flip with light/dark (globals.css: :root 0.965 vs .dark 0.22).
        // Applying a single `mutedColor` inline here pinned it light in dark
        // mode, so every bg-muted surface (table header, icon badges, hover)
        // went white-on-white. Let the CSS tokens own --muted like --card/--bg.
        ["--radius", `${settings.radius}rem`],
        ["--glass-intensity", `${settings.glassIntensity}`],
        ["--shadow-strength", `${settings.shadowStrength}`],
        ["--spacing-unit", `${settings.spacingUnit}rem`],
        ["--font-scale", `${settings.fontScale}`],
        ["--header-height", `${settings.headerHeight}rem`],
        ["--sidebar-width", `${settings.sidebarWidth}rem`],
        ["--max-content-width", `${settings.maxContentWidth}rem`],
        ["--anim-duration-scale", settings.reducedMotion ? "0" : `${settings.animationScale}`],
      ]
      updates.forEach(([prop, val]) => root.style.setProperty(prop, val))
      Object.entries(settings.componentStyles).forEach(([id, styles]) => {
        Object.entries(styles).forEach(([k, v]) => {
          const cssVar = `--${id}-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}`
          root.style.setProperty(cssVar, `${v}${typeof v === "number" ? "rem" : ""}`)
        })
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    }
    requestAnimationFrame(apply)
  }, [settings, isInitialized])
}

function applyImmediateComponentStyle(
  componentId: string,
  property: string,
  value: string | number,
  elementId?: string,
) {
  const cssVarKey = elementId ? `${componentId}-${elementId}-${property}` : `${componentId}-${property}`
  const cssVar = `--${cssVarKey.replace(/([A-Z])/g, "-$1").toLowerCase()}`
  document.documentElement.style.setProperty(cssVar, `${value}${typeof value === "number" ? "rem" : ""}`)
}

// ============================================================================
// MAIN PROVIDER WITH NEXT-THEMES WRAPPER
// ============================================================================

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </NextThemesProvider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { themePresets, type ThemePresetId }
