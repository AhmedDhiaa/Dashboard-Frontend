"use client"

/**
 * Language & Region Settings Page
 *
 * ARCHITECTURAL EXCEPTION: Utility page for language/region preferences.
 * Not a CRUD entity - exempt from config-driven requirements.
 *
 * REFACTORED: Extracted components to reduce line count
 */

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { ArrowLeft, Globe } from "lucide-react"
import Link from "next/link"
import { useNotification } from "@/ui/application"
import { useT } from "@/shared/config"
import { styles } from "@/ui/utils"
import { LanguageSelector, RegionSelector } from "@/features/settings"

const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "fr", name: "French", nativeName: "Francais" },
  { code: "es", name: "Spanish", nativeName: "Espanol" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
]

const regions = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
]

export default function SettingsLanguagePage() {
  const t = useT("settings")
  const notifications = useNotification()
  const [selectedLanguage, setSelectedLanguage] = useState("en")
  const [selectedRegion, setSelectedRegion] = useState("US")

  const handleLanguageChange = (code: string) => {
    setSelectedLanguage(code)
    notifications.success("common.messages.successUpdate")
  }

  const handleRegionChange = (code: string) => {
    setSelectedRegion(code)
    notifications.success("common.messages.successUpdate")
  }

  return (
    <div className={styles.page}>
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/settings">
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("language.back_to_settings")}
        </Link>
      </Button>

      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t("sections.language.title")}
            </CardTitle>
            <CardDescription>{t("language.page_description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <LanguageSelector
              languages={languages}
              selectedLanguage={selectedLanguage}
              onLanguageChange={handleLanguageChange}
              label={t("language.language_label")}
            />

            <RegionSelector
              regions={regions}
              selectedRegion={selectedRegion}
              onRegionChange={handleRegionChange}
              label={t("language.region_label")}
            />

            <div className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-lg p-4">
              <p className="text-sm text-primary dark:text-primary/90">
                <strong>{t("language.refresh_note_label")}</strong> {t("language.refresh_note_body")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
