import type { ThemePreset } from "./types"

export const highContrastTheme: ThemePreset = {
  id: "high-contrast",
  name: "High Contrast",
  description: "Maximum readability with bold contrast - WCAG AAA compliant",
  preview: {
    primary: "oklch(0.40 0.20 250)",
    secondary: "oklch(0.50 0.18 30)",
    accent: "oklch(0.45 0.22 145)",
    background: "oklch(1 0 0)",
  },
  colors: {
    // Base - Pure white/black for maximum contrast
    background: "oklch(1 0 0)",
    foreground: "oklch(0.12 0.02 0)",

    // Card & Popover
    card: "oklch(0.99 0.001 0)",
    cardForeground: "oklch(0.12 0.02 0)",
    popover: "oklch(0.99 0.001 0)",
    popoverForeground: "oklch(0.12 0.02 0)",

    // Brand - High contrast colors
    primary: "oklch(0.40 0.20 250)",
    primaryForeground: "oklch(1 0 0)",
    secondary: "oklch(0.50 0.18 30)",
    secondaryForeground: "oklch(1 0 0)",
    accent: "oklch(0.45 0.22 145)",
    accentForeground: "oklch(1 0 0)",

    // Semantic - Bold semantic colors
    success: "oklch(0.42 0.18 145)",
    successForeground: "oklch(1 0 0)",
    warning: "oklch(0.55 0.18 75)",
    warningForeground: "oklch(0.12 0.02 75)",
    destructive: "oklch(0.45 0.25 25)",
    destructiveForeground: "oklch(1 0 0)",
    info: "oklch(0.42 0.18 250)",
    infoForeground: "oklch(1 0 0)",

    // Muted & UI
    muted: "oklch(0.94 0.003 0)",
    mutedForeground: "oklch(0.35 0.02 0)",
    border: "oklch(0.70 0.01 0)",
    input: "oklch(0.96 0.002 0)",
    ring: "oklch(0.40 0.20 250)",

    // Sidebar
    sidebar: "oklch(0.97 0.002 0)",
    sidebarForeground: "oklch(0.15 0.02 0)",
    sidebarPrimary: "oklch(0.40 0.20 250)",
    sidebarPrimaryForeground: "oklch(1 0 0)",
    sidebarAccent: "oklch(0.90 0.005 0)",
    sidebarAccentForeground: "oklch(0.18 0.02 0)",
    sidebarBorder: "oklch(0.75 0.01 0)",
    sidebarRing: "oklch(0.40 0.20 250)",

    // Premium & Charts
    premium: "oklch(0.45 0.22 280)",
    premiumForeground: "oklch(1 0 0)",
    chart1: "oklch(0.40 0.20 250)",
    chart2: "oklch(0.50 0.18 30)",
    chart3: "oklch(0.45 0.22 145)",
    chart4: "oklch(0.42 0.18 200)",
    chart5: "oklch(0.45 0.22 280)",
  },
  aesthetics: {
    radius: 0.5,
    glassIntensity: 0,
    shadowStrength: 0.12,
  },
  layout: {
    spacingUnit: 1.1,
    fontScale: 1.05,
    headerHeight: 4.5,
    sidebarWidth: 18,
    maxContentWidth: 75,
  },
  motion: {
    animationScale: 0.8,
  },
}
