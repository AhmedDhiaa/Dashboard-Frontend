"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import { AlertTriangle, Home, RefreshCcw } from "lucide-react"
import { logger } from "@/shared/logger"
import { useT } from "@/shared/config"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("errors")

  useEffect(() => {
    // Log error to error reporting service
    logger.error("Application error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardContent className="pt-12 pb-12 text-center">
          <div className="mx-auto w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-8">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>

          <h1 className="text-7xl font-bold text-foreground mb-4">500</h1>

          <h2 className="text-3xl font-bold text-foreground mb-4">{t("500_title")}</h2>

          <p className="text-lg text-muted-foreground mb-2 max-w-md mx-auto">{t("500_description")}</p>

          {error.digest && (
            <p className="text-sm text-muted-foreground mb-8 font-mono">
              {t("error_id")}: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button onClick={reset} variant="outline" size="lg" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              {t("try_again")}
            </Button>
            <Link href="/">
              <Button variant="primary" size="lg" className="gap-2">
                <Home className="h-4 w-4" />
                {t("go_to_dashboard")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
