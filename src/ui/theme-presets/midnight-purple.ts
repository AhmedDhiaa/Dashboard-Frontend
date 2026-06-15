import type { ThemePreset } from "./types"

export const midnightPurpleTheme: ThemePreset = {
  id: "midnight-purple",
  name: "Midnight Purple",
  description: "Rich purples with gold accents - luxurious and creative",
  preview: {
    primary: "oklch(0.60 0.18 290)",
    secondary: "oklch(0.75 0.12 85)",
    accent: "oklch(0.68 0.16 340)",
    background: "oklch(0.12 0.02 290)",
  },
  colors: {
    // Base - Deep purple-tinted dark
    background: "oklch(0.12 0.02 290)",
    foreground: "oklch(0.95 0.008 290)",

    // Card & Popover
    card: "oklch(0.16 0.022 290)",
    cardForeground: "oklch(0.95 0.008 290)",
    popover: "oklch(0.14 0.02 290)",
    popoverForeground: "oklch(0.95 0.008 290)",

    // Brand - Purple primary, Gold secondary
    primary: "oklch(0.60 0.18 290)",
    primaryForeground: "oklch(0.12 0.02 290)",
    secondary: "oklch(0.75 0.12 85)",
    secondaryForeground: "oklch(0.18 0.03 85)",
    accent: "oklch(0.68 0.16 340)",
    accentForeground: "oklch(0.12 0.02 340)",

    // Semantic
    success: "oklch(0.65 0.15 155)",
    successForeground: "oklch(0.12 0.01 155)",
    warning: "oklch(0.75 0.14 80)",
    warningForeground: "oklch(0.18 0.02 80)",
    destructive: "oklch(0.60 0.22 25)",
    destructiveForeground: "oklch(0.95 0.005 25)",
    info: "oklch(0.65 0.14 250)",
    infoForeground: "oklch(0.12 0.01 250)",

    // Muted & UI
    muted: "oklch(0.20 0.022 290)",
    mutedForeground: "oklch(0.62 0.025 290)",
    border: "oklch(0.26 0.025 290)",
    input: "oklch(0.18 0.02 290)",
    ring: "oklch(0.60 0.18 290)",

    // Sidebar
    sidebar: "oklch(0.14 0.018 290)",
    sidebarForeground: "oklch(0.92 0.006 290)",
    sidebarPrimary: "oklch(0.60 0.18 290)",
    sidebarPrimaryForeground: "oklch(0.12 0.02 290)",
    sidebarAccent: "oklch(0.20 0.024 290)",
    sidebarAccentForeground: "oklch(0.90 0.006 290)",
    sidebarBorder: "oklch(0.24 0.022 290)",
    sidebarRing: "oklch(0.60 0.18 290)",

    // Premium & Charts
    premium: "oklch(0.75 0.12 85)",
    premiumForeground: "oklch(0.18 0.03 85)",
    chart1: "oklch(0.60 0.18 290)",
    chart2: "oklch(0.75 0.12 85)",
    chart3: "oklch(0.68 0.16 340)",
    chart4: "oklch(0.65 0.15 155)",
    chart5: "oklch(0.65 0.14 250)",
  },
  aesthetics: {
    radius: 1.25,
    glassIntensity: 0.22,
    shadowStrength: 0.18,
  },
  layout: {
    spacingUnit: 1,
    fontScale: 1,
    headerHeight: 4,
    sidebarWidth: 16,
    maxContentWidth: 80,
  },
  motion: {
    animationScale: 1.3,
  },
}
