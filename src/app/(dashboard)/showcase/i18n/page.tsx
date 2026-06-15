"use client"

import { useLocale } from "next-intl"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { PageHeader } from "@/ui/layout/PageHeader"
import { useT } from "@/shared/config"
import { useRouter } from "next/navigation"

export default function I18nShowcase() {
  const locale = useLocale()
  const router = useRouter()
  const tCrud = useT("crud")
  const tCommon = useT("common")
  const isRTL = locale === "ar"

  const switchLocale = (next: "en" | "ar") => {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`
    router.refresh()
  }

  return (
    <div className="space-y-8" dir={isRTL ? "rtl" : "ltr"}>
      <PageHeader
        title={tCommon("app.name") || "Acme"}
        description={`Current locale: ${locale} | Direction: ${isRTL ? "RTL" : "LTR"}`}
        actions={
          <div className="flex gap-2">
            <Button variant={locale === "en" ? "primary" : "outline"} size="sm" onClick={() => switchLocale("en")}>
              EN
            </Button>
            <Button variant={locale === "ar" ? "primary" : "outline"} size="sm" onClick={() => switchLocale("ar")}>
              AR
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CRUD Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {(["create", "edit", "delete", "view", "save", "cancel", "export", "import"] as const).map(action => (
              <div key={action} className="flex items-center justify-between border rounded p-2">
                <span className="text-xs font-mono text-muted-foreground">crud.actions.{action}</span>
                <span className="text-sm font-medium">{tCrud(`actions.${action}`)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RTL Layout Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This card respects the <code>dir</code> attribute. In Arabic mode, text flows right-to-left.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Badge</span>
              <span className="text-sm">followed by text</span>
            </div>
            <div className="flex items-center justify-between">
              <Button size="sm">Start Button</Button>
              <Button size="sm" variant="outline">
                End Button
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
