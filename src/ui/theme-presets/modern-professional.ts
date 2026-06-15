import type { ThemePreset } from "./types"

export const modernProfessionalTheme: ThemePreset = {
  id: "modern-professional",
  name: "Modern Professional",
  description: "Clean teal primary with warm amber accents - professional and trustworthy",
  preview: {
    primary: "oklch(0.55 0.12 220)",
    secondary: "oklch(0.72 0.12 80)",
    accent: "oklch(0.65 0.15 165)",
    background: "oklch(0.985 0.002 240)",
  },
  colors: {
    // Base - Clean light background with subtle warmth
    background: "oklch(0.985 0.002 240)",
    foreground: "oklch(0.18 0.02 240)",

    // Card & Popover - Pure white with subtle elevation
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.18 0.02 240)",
    popover: "oklch(1 0 0)",
    popoverForeground: "oklch(0.18 0.02 240)",

    // Brand - Teal primary, Amber secondary
    primary: "oklch(0.55 0.12 220)",
    primaryForeground: "oklch(0.99 0.002 240)",
    secondary: "oklch(0.72 0.12 80)",
    secondaryForeground: "oklch(0.25 0.03 80)",
    accent: "oklch(0.65 0.15 165)",
    accentForeground: "oklch(0.18 0.02 165)",

    // Semantic - Professional palette
    success: "oklch(0.62 0.17 145)",
    successForeground: "oklch(0.99 0.002 145)",
    warning: "oklch(0.75 0.15 75)",
    warningForeground: "oklch(0.25 0.03 75)",
    destructive: "oklch(0.55 0.22 25)",
    destructiveForeground: "oklch(0.99 0.002 25)",
    info: "oklch(0.60 0.14 250)",
    infoForeground: "oklch(0.99 0.002 250)",

    // Muted & UI
    muted: "oklch(0.96 0.005 240)",
    mutedForeground: "oklch(0.50 0.02 240)",
    border: "oklch(0.90 0.008 240)",
    input: "oklch(0.97 0.003 240)",
    ring: "oklch(0.55 0.12 220)",

    // Sidebar
    sidebar: "oklch(0.99 0.002 240)",
    sidebarForeground: "oklch(0.25 0.02 240)",
    sidebarPrimary: "oklch(0.55 0.12 220)",
    sidebarPrimaryForeground: "oklch(0.99 0.002 240)",
    sidebarAccent: "oklch(0.95 0.01 220)",
    sidebarAccentForeground: "oklch(0.35 0.03 240)",
    sidebarBorder: "oklch(0.92 0.006 240)",
    sidebarRing: "oklch(0.55 0.12 220)",

    // Premium & Charts
    premium: "oklch(0.58 0.20 280)",
    premiumForeground: "oklch(0.98 0.002 280)",
    chart1: "oklch(0.55 0.12 220)",
    chart2: "oklch(0.72 0.12 80)",
    chart3: "oklch(0.65 0.15 165)",
    chart4: "oklch(0.62 0.17 145)",
    chart5: "oklch(0.58 0.20 280)",
  },
  aesthetics: {
    radius: 0.75,
    glassIntensity: 0.15,
    shadowStrength: 0.08,
  },
  layout: {
    spacingUnit: 1,
    fontScale: 1,
    headerHeight: 4,
    sidebarWidth: 16,
    maxContentWidth: 80,
  },
  motion: {
    animationScale: 1,
  },
}
