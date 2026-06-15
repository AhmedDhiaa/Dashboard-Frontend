"use client"

import { Skeleton } from "@/ui/design-system/primitives/skeleton"

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-8 w-48" />
    </div>
  )
}
