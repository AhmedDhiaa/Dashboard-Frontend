"use client"

import { Skeleton } from "@/ui/design-system/primitives/skeleton"

export function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Table header */}
      <div className="rounded-md border">
        <Skeleton className="h-12 w-full" />

        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-64" />
      </div>
    </div>
  )
}
