"use client"

import { PageHeader } from "@/ui/layout/PageHeader"
import { Alert, AlertDescription, AlertTitle } from "@/ui/design-system/primitives/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { useNotification } from "@/ui/application/hooks/useNotification"

export default function FeedbackShowcase() {
  const notify = useNotification()

  return (
    <div className="space-y-8">
      <PageHeader title="Feedback" description="Toasts, alerts, confirm dialogs, error states" />

      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              { variant: "default", icon: Info, title: "Info", desc: "Informational message." },
              { variant: "success", icon: CheckCircle2, title: "Success", desc: "Operation completed." },
              { variant: "warning", icon: AlertTriangle, title: "Warning", desc: "Review before continuing." },
              { variant: "destructive", icon: XCircle, title: "Error", desc: "Something went wrong." },
            ] as const
          ).map(({ variant, icon: Icon, title, desc }) => (
            <Alert key={variant} variant={variant}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{desc}</AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toasts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => notify.success("common.success")}>
            Success Toast
          </Button>
          <Button variant="outline" size="sm" onClick={() => notify.error("common.error")}>
            Error Toast
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
