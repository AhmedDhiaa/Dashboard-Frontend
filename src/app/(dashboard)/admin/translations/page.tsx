"use client"

import nextDynamic from "next/dynamic"

const TranslationsAdminPage = nextDynamic(
  () => import("@/features/admin-tools/translation-editor").then(m => m.TranslationsAdminPage),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div> },
)

export default function Page() {
  return <TranslationsAdminPage />
}
