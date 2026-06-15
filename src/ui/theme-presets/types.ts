export interface ThemePreset {
  id: string
  name: string
  description: string
  preview: {
    primary: string
    secondary: string
    accent: string
    background: string
  }
  colors: {
    // Base colors
    background: string
    foreground: string

    // Card & Popover
    card: string
    cardForeground: string
    popover: string
    popoverForeground: string

    // Brand colors
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    accent: string
    accentForeground: string

    // Semantic colors
    success: string
    successForeground: string
    warning: string
    warningForeground: string
    destructive: string
    destructiveForeground: string
    info: string
    infoForeground: string

    // Muted & UI elements
    muted: string
    mutedForeground: string
    border: string
    input: string
    ring: string

    // Sidebar
    sidebar: string
    sidebarForeground: string
    sidebarPrimary: string
    sidebarPrimaryForeground: string
    sidebarAccent: string
    sidebarAccentForeground: string
    sidebarBorder: string
    sidebarRing: string

    // Premium & Charts
    premium: string
    premiumForeground: string
    chart1: string
    chart2: string
    chart3: string
    chart4: string
    chart5: string
  }

  // Aesthetic settings
  aesthetics: {
    radius: number
    glassIntensity: number
    shadowStrength: number
  }

  // Layout settings
  layout: {
    spacingUnit: number
    fontScale: number
    headerHeight: number
    sidebarWidth: number
    maxContentWidth: number
  }

  // Animation settings
  motion: {
    animationScale: number
  }
}
