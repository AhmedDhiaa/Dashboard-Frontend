"use client"

/**
 * Profile Settings Page
 *
 * ARCHITECTURAL EXCEPTION: Utility page for user profile management.
 * Not a CRUD entity - exempt from config-driven requirements.
 */

import { useT } from "@/shared/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { ArrowLeft, User } from "lucide-react"
import Link from "next/link"
import { TextField, TextAreaField } from "@/core/crud/components/FormField"
import { useForm } from "react-hook-form"
import { useNotification } from "@/ui/application"
import { styles } from "@/ui/utils"
import { Form } from "@/ui/design-system/primitives/form"

export default function SettingsProfilePage() {
  const t = useT()
  const notifications = useNotification()

  const form = useForm({
    defaultValues: {
      name: "Admin User",
      email: "admin@acme.com",
      phone: "+9647700000000",
      bio: "Administrator for Acme Analytics Dashboard",
    },
  })

  const onSubmit = () => {
    notifications.success("settings.profile.save_success")
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
              <User className="h-5 w-5" />
              {t("settings.profile.title")}
            </CardTitle>
            <CardDescription>{t("settings.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className={styles.grid2}>
                  <TextField name="name" label={t("common.fields.full_name")} required />
                  <TextField name="email" label={t("common.fields.email")} type="email" required />
                </div>
                <TextField name="phone" label={t("common.fields.phone")} />
                <TextAreaField name="bio" label={t("common.fields.bio")} rows={3} />
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
