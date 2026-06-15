"use client"

import nextDynamic from "next/dynamic"

const GitBridgePage = nextDynamic(() => import("@/features/admin-tools/git-bridge").then(m => m.GitBridgePage), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>,
})

export default function Page() {
  return <GitBridgePage />
}
