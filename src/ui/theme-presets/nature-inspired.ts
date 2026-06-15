import type { ThemePreset } from "./types"

export const natureInspiredTheme: ThemePreset = {
  id: "nature-inspired",
  name: "Nature Inspired",
  description: "Earthy greens and warm terracotta - organic and calming",
  preview: {
    primary: "oklch(0.55 0.14 145)",
    secondary: "oklch(0.65 0.12 50)",
    accent: "oklch(0.70 0.10 90)",
    background: "oklch(0.98 0.008 90)",
  },
  colors: {
    // Base - Warm off-white with natural tint
    background: "oklch(0.98 0.008 90)",
    foreground: "oklch(0.22 0.03 90)",

    // Card & Popover
    card: "oklch(0.995 0.004 90)",
    cardForeground: "oklch(0.22 0.03 90)",
    popover: "oklch(0.995 0.004 90)",
    popoverForeground: "oklch(0.22 0.03 90)",

    // Brand - Forest green primary, Terracotta secondary
    primary: "oklch(0.55 0.14 145)",
    primaryForeground: "oklch(0.98 0.005 145)",
    secondary: "oklch(0.65 0.12 50)",
    secondaryForeground: "oklch(0.25 0.03 50)",
    accent: "oklch(0.70 0.10 90)",
    accentForeground: "oklch(0.22 0.03 90)",

    // Semantic
    success: "oklch(0.58 0.15 155)",
    successForeground: "oklch(0.98 0.005 155)",
    warning: "oklch(0.72 0.14 70)",
    warningForeground: "oklch(0.25 0.03 70)",
    destructive: "oklch(0.55 0.18 30)",
    destructiveForeground: "oklch(0.98 0.005 30)",
    info: "oklch(0.58 0.12 220)",
    infoForeground: "oklch(0.98 0.005 220)",

    // Muted & UI
    muted: "oklch(0.95 0.012 90)",
    mutedForeground: "oklch(0.48 0.03 90)",
    border: "oklch(0.88 0.015 90)",
    input: "oklch(0.96 0.008 90)",
    ring: "oklch(0.55 0.14 145)",

    // Sidebar
    sidebar: "oklch(0.97 0.006 90)",
    sidebarForeground: "oklch(0.28 0.03 90)",
    sidebarPrimary: "oklch(0.55 0.14 145)",
    sidebarPrimaryForeground: "oklch(0.98 0.005 145)",
    sidebarAccent: "oklch(0.93 0.015 90)",
    sidebarAccentForeground: "oklch(0.35 0.04 90)",
    sidebarBorder: "oklch(0.90 0.012 90)",
    sidebarRing: "oklch(0.55 0.14 145)",

    // Premium & Charts
    premium: "oklch(0.58 0.18 30)",
    premiumForeground: "oklch(0.98 0.005 30)",
    chart1: "oklch(0.55 0.14 145)",
    chart2: "oklch(0.65 0.12 50)",
    chart3: "oklch(0.70 0.10 90)",
    chart4: "oklch(0.58 0.15 155)",
    chart5: "oklch(0.58 0.12 220)",
  },
  aesthetics: {
    radius: 1,
    glassIntensity: 0.12,
    shadowStrength: 0.06,
  },
  layout: {
    spacingUnit: 1,
    fontScale: 1,
    headerHeight: 4,
    sidebarWidth: 16,
    maxContentWidth: 80,
  },
  motion: {
    animationScale: 1.1,
  },
}
