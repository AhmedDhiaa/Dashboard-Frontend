"use client"

/**
 * Security Settings Page
 *
 * ARCHITECTURAL EXCEPTION: Utility page for security settings (password, 2FA).
 * Not a CRUD entity - exempt from config-driven requirements.
 */

import { useT } from "@/shared/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"
import { TextField } from "@/core/crud/components/FormField"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNotification } from "@/ui/application"
import { styles } from "@/ui/utils"
import { Form } from "@/ui/design-system/primitives/form"

export default function SettingsSecurityPage() {
  const t = useT()
  const notifications = useNotification()

  const passwordSchema = z
    .object({
      currentPassword: z.string().min(1, t("common.validation.required")),
      newPassword: z.string().min(8, t("errors.min_length", { min: 8 })),
      confirmPassword: z.string().min(1, t("common.validation.required")),
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: t("errors.passwords_mismatch"),
      path: ["confirmPassword"],
    })

  const form = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  const onSubmit = () => {
    notifications.success("settings.security.password_success")
    form.reset()
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
              <Shield className="h-5 w-5" />
              {t("settings.security.title")}
            </CardTitle>
            <CardDescription>{t("settings.security.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <TextField
                  name="currentPassword"
                  label={t("common.fields.current_password")}
                  type="password"
                  required
                />
                <TextField name="newPassword" label={t("common.fields.new_password")} type="password" required />
                <TextField
                  name="confirmPassword"
                  label={t("common.fields.confirm_password")}
                  type="password"
                  required
                />
                <div className="pt-4">
                  <Button type="submit" className="w-full">
                    {t("common.update")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
