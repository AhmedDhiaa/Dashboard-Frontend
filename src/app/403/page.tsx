"use client"

import Link from "next/link"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import { Shield, Home, ArrowLeft, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { useT } from "@/shared/config"

export default function ForbiddenPage() {
  const t = useT("errors")

  const handleReauthenticate = async () => {
    await signOut({ redirect: false })
    window.location.href = "/auth/login"
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="pt-12 pb-12 text-center">
          <div className="mx-auto w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-8">
            <Shield className="h-12 w-12 text-destructive" />
          </div>

          <h1 className="text-7xl font-bold text-foreground mb-4">403</h1>

          <h2 className="text-3xl font-bold text-foreground mb-4">{t("403_title")}</h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">{t("403_description")}</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => window.history.back()} variant="outline" size="lg" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("go_back")}
            </Button>

            <Button
              onClick={handleReauthenticate}
              variant="outline"
              size="lg"
              className="gap-2 border-destructive/20 hover:bg-destructive/5 text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {t("logout_and_relogin") || "Logout & Re-login"}
            </Button>

            <Link href="/">
              <Button size="lg" className="gap-2">
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
