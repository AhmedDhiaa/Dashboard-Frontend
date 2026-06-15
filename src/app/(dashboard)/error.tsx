"use client"

import { useEffect } from "react"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { AlertTriangle } from "lucide-react"
import { logger } from "@/shared/logger"
import { useT } from "@/shared/config"

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT("errors")

  useEffect(() => {
    logger.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle>{t("500_title")}</CardTitle>
          </div>
          <CardDescription>{t("500_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={reset}>{t("try_again")}</Button>
        </CardContent>
      </Card>
    </div>
  )
}
