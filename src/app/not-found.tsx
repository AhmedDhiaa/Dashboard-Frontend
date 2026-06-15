"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import { FileQuestion, Home, Search, ArrowLeft } from "lucide-react"
import { useT } from "@/shared/config"

export default function NotFoundPage() {
  const t = useT("errors")
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardContent className="pt-12 pb-12 text-center">
          <div
            className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8"
            aria-hidden="true"
          >
            <FileQuestion className="h-12 w-12 text-primary" />
          </div>

          <h1 className="text-7xl font-bold text-foreground mb-4" aria-label="404">
            404
          </h1>

          <h2 className="text-3xl font-bold text-foreground mb-4">{t("404_title")}</h2>

          <p className="text-lg text-muted-foreground mb-3 max-w-md mx-auto">{t("404_description")}</p>
          <p className="text-sm text-muted-foreground/70 mb-8 max-w-md mx-auto">{t("404_hint")}</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <Button variant="ghost" size="lg" className="gap-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("go_back_history")}
            </Button>
            <Link href="/">
              <Button variant="outline" size="lg" className="gap-2">
                <Search className="h-4 w-4" aria-hidden="true" />
                {t("open_search")}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="primary" size="lg" className="gap-2">
                <Home className="h-4 w-4" aria-hidden="true" />
                {t("go_to_dashboard")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
