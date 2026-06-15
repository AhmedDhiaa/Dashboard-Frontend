import type { ThemePreset } from "./types"

export const darkElegantTheme: ThemePreset = {
  id: "dark-elegant",
  name: "Dark Elegant",
  description: "Deep charcoal with electric blue accents - sleek and sophisticated",
  preview: {
    primary: "oklch(0.68 0.16 250)",
    secondary: "oklch(0.70 0.14 320)",
    accent: "oklch(0.72 0.18 180)",
    background: "oklch(0.14 0.015 270)",
  },
  colors: {
    // Base - True deep dark
    background: "oklch(0.14 0.015 270)",
    foreground: "oklch(0.96 0.005 270)",

    // Card & Popover - Elevated dark surfaces
    card: "oklch(0.18 0.018 270)",
    cardForeground: "oklch(0.96 0.005 270)",
    popover: "oklch(0.16 0.016 270)",
    popoverForeground: "oklch(0.96 0.005 270)",

    // Brand - Electric blue primary, Purple secondary
    primary: "oklch(0.68 0.16 250)",
    primaryForeground: "oklch(0.14 0.015 250)",
    secondary: "oklch(0.70 0.14 320)",
    secondaryForeground: "oklch(0.18 0.02 320)",
    accent: "oklch(0.72 0.18 180)",
    accentForeground: "oklch(0.14 0.015 180)",

    // Semantic - Dark mode optimized
    success: "oklch(0.68 0.16 145)",
    successForeground: "oklch(0.14 0.01 145)",
    warning: "oklch(0.75 0.14 75)",
    warningForeground: "oklch(0.18 0.02 75)",
    destructive: "oklch(0.62 0.22 25)",
    destructiveForeground: "oklch(0.96 0.005 25)",
    info: "oklch(0.68 0.15 250)",
    infoForeground: "oklch(0.14 0.01 250)",

    // Muted & UI
    muted: "oklch(0.22 0.018 270)",
    mutedForeground: "oklch(0.65 0.02 270)",
    border: "oklch(0.28 0.02 270)",
    input: "oklch(0.20 0.016 270)",
    ring: "oklch(0.68 0.16 250)",

    // Sidebar
    sidebar: "oklch(0.16 0.014 270)",
    sidebarForeground: "oklch(0.94 0.004 270)",
    sidebarPrimary: "oklch(0.68 0.16 250)",
    sidebarPrimaryForeground: "oklch(0.14 0.015 250)",
    sidebarAccent: "oklch(0.22 0.02 270)",
    sidebarAccentForeground: "oklch(0.92 0.004 270)",
    sidebarBorder: "oklch(0.26 0.018 270)",
    sidebarRing: "oklch(0.68 0.16 250)",

    // Premium & Charts
    premium: "oklch(0.65 0.20 280)",
    premiumForeground: "oklch(0.98 0.002 280)",
    chart1: "oklch(0.68 0.16 250)",
    chart2: "oklch(0.72 0.18 180)",
    chart3: "oklch(0.70 0.14 320)",
    chart4: "oklch(0.68 0.16 145)",
    chart5: "oklch(0.65 0.20 280)",
  },
  aesthetics: {
    radius: 1,
    glassIntensity: 0.2,
    shadowStrength: 0.15,
  },
  layout: {
    spacingUnit: 1,
    fontScale: 1,
    headerHeight: 4,
    sidebarWidth: 16,
    maxContentWidth: 80,
  },
  motion: {
    animationScale: 1.2,
  },
}
