"use client"

/**
 * Theme Settings Page
 *
 * ARCHITECTURAL EXCEPTION: Utility page for theme preferences (dark/light mode).
 * Not a CRUD entity - exempt from config-driven requirements.
 *
 * REFACTORED: Extracted components and replaced hardcoded colors with semantic tokens
 */

import { useState } from "react"
import { useT } from "@/shared/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { ArrowLeft, Palette } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useNotification } from "@/ui/application"
import { styles } from "@/ui/utils"
import { ThemeSelector, ColorSchemeSelector, FontSizeControl } from "@/features/settings"

export default function SettingsThemePage() {
  const { theme, setTheme } = useTheme()
  const t = useT()
  const notifications = useNotification()
  const [selectedColor, setSelectedColor] = useState("blue")

  const themes = [
    {
      id: "light",
      labelKey: "common.theme.light",
      descriptionKey: "settings.theme.themes.light.description",
    },
    {
      id: "dark",
      labelKey: "common.theme.dark",
      descriptionKey: "settings.theme.themes.dark.description",
    },
    {
      id: "system",
      labelKey: "common.theme.system",
      descriptionKey: "settings.theme.themes.system.description",
    },
  ]

  // Using semantic color classes instead of hardcoded colors
  const colorSchemes = [
    { id: "blue", labelKey: "settings.theme.colors.blue", colorClass: "bg-primary" },
    { id: "indigo", labelKey: "settings.theme.colors.indigo", colorClass: "bg-accent" },
    { id: "purple", labelKey: "settings.theme.colors.purple", colorClass: "bg-secondary" },
    { id: "pink", labelKey: "settings.theme.colors.pink", colorClass: "bg-destructive" },
    { id: "green", labelKey: "settings.theme.colors.green", colorClass: "bg-success" },
  ]

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    notifications.success("crud.messages.success_update")
  }

  const handleColorChange = (color: string) => {
    setSelectedColor(color)
    notifications.success("crud.messages.success_update")
  }

  const handleFontSizeChange = () => {
    notifications.success("crud.messages.success_update")
  }

  return (
    <div className={styles.page}>
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/settings">
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("common.back")}
        </Link>
      </Button>

      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("settings.sections.appearance.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.theme.appearance_description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ThemeSelector themes={themes} currentTheme={theme} onThemeChange={handleThemeChange} t={t} />

            <ColorSchemeSelector
              colorSchemes={colorSchemes}
              selectedColor={selectedColor}
              onColorChange={handleColorChange}
              t={t}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.theme.font_size_title")}</CardTitle>
            <CardDescription>
              {t("settings.theme.font_size_description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FontSizeControl t={t} onFontSizeChange={handleFontSizeChange} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
