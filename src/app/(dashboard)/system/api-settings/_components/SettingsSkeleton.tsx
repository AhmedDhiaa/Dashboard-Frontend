"use client"

import { Skeleton } from "@/ui/design-system/primitives/skeleton"

export function SettingsSkeleton() {
  return (
    <div className="flex h-[calc(100vh-10rem)] bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="w-56 border-e bg-muted/5 p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
