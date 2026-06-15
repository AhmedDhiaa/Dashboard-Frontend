import type { ThemePreset } from "./types"

/**
 * Apply a theme preset to the document root with performance optimization
 */
export function applyThemePreset(preset: ThemePreset): void {
  const root = document.documentElement

  // Disable transitions temporarily for instant theme switch
  root.classList.add("no-transition")

  // Batch all CSS variable updates
  const cssVars: string[] = []

  // Apply colors
  const colorMap: Record<string, keyof ThemePreset["colors"]> = {
    "--background": "background",
    "--foreground": "foreground",
    "--card": "card",
    "--card-foreground": "cardForeground",
    "--popover": "popover",
    "--popover-foreground": "popoverForeground",
    "--primary": "primary",
    "--primary-foreground": "primaryForeground",
    "--secondary": "secondary",
    "--secondary-foreground": "secondaryForeground",
    "--accent": "accent",
    "--accent-foreground": "accentForeground",
    "--success": "success",
    "--success-foreground": "successForeground",
    "--warning": "warning",
    "--warning-foreground": "warningForeground",
    "--destructive": "destructive",
    "--destructive-foreground": "destructiveForeground",
    "--info": "info",
    "--info-foreground": "infoForeground",
    "--muted": "muted",
    "--muted-foreground": "mutedForeground",
    "--border": "border",
    "--input": "input",
    "--ring": "ring",
    "--sidebar": "sidebar",
    "--sidebar-foreground": "sidebarForeground",
    "--sidebar-primary": "sidebarPrimary",
    "--sidebar-primary-foreground": "sidebarPrimaryForeground",
    "--sidebar-accent": "sidebarAccent",
    "--sidebar-accent-foreground": "sidebarAccentForeground",
    "--sidebar-border": "sidebarBorder",
    "--sidebar-ring": "sidebarRing",
    "--premium": "premium",
    "--premium-foreground": "premiumForeground",
    "--chart-1": "chart1",
    "--chart-2": "chart2",
    "--chart-3": "chart3",
    "--chart-4": "chart4",
    "--chart-5": "chart5",
  }

  for (const [cssVar, colorKey] of Object.entries(colorMap)) {
    cssVars.push(`${cssVar}: ${preset.colors[colorKey]}`)
  }

  // Apply aesthetics
  cssVars.push(`--radius-sm: ${preset.aesthetics.radius * 0.5}rem`)
  cssVars.push(`--radius-md: ${preset.aesthetics.radius}rem`)
  cssVars.push(`--radius-lg: ${preset.aesthetics.radius * 1.5}rem`)
  cssVars.push(`--radius-xl: ${preset.aesthetics.radius * 2}rem`)
  cssVars.push(`--radius: ${preset.aesthetics.radius}rem`)
  cssVars.push(`--glass-intensity: ${preset.aesthetics.glassIntensity}`)
  cssVars.push(`--shadow-strength: ${preset.aesthetics.shadowStrength}`)

  // Apply layout
  cssVars.push(`--spacing-unit: ${preset.layout.spacingUnit}rem`)
  cssVars.push(`--font-scale: ${preset.layout.fontScale}`)
  cssVars.push(`--header-height: ${preset.layout.headerHeight}rem`)
  cssVars.push(`--sidebar-width: ${preset.layout.sidebarWidth}rem`)
  cssVars.push(`--max-content-width: ${preset.layout.maxContentWidth}rem`)

  // Apply motion
  cssVars.push(`--anim-duration-scale: ${preset.motion.animationScale}`)

  // Apply each variable individually via setProperty so we DON'T clobber other
  // inline :root vars (e.g. per-component overrides set elsewhere). Assigning
  // `root.style.cssText` would wipe those — switching a preset must not erase
  // live component customizations.
  for (const decl of cssVars) {
    const sep = decl.indexOf(":")
    if (sep === -1) continue
    root.style.setProperty(decl.slice(0, sep).trim(), decl.slice(sep + 1).trim())
  }

  // Re-enable transitions after a frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("no-transition")
    })
  })
}
