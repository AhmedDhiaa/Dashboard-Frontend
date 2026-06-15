"use client"

import nextDynamic from "next/dynamic"

const ThemeCustomizerPage = nextDynamic(
  () => import("@/features/admin-tools/theme-customizer").then(m => m.ThemeCustomizerPage),
  { ssr: false, loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div> },
)

export default function Page() {
  return <ThemeCustomizerPage />
}
