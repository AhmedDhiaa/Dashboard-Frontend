"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { BuilderPage } from "@/features/runtime-builder"

function BuilderPageInner() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") ?? "entities"
  return <BuilderPage defaultTab={tab} />
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BuilderPageInner />
    </Suspense>
  )
}
