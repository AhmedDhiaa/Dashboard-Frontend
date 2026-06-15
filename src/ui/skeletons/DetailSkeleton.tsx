"use client"

import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { Card, CardContent, CardHeader } from "@/ui/design-system/primitives/card"

export function DetailSkeleton({
  sections = 3,
  fieldsPerSection = 4,
}: {
  sections?: number
  fieldsPerSection?: number
}) {
  return (
    <div className="grid gap-6">
      {Array.from({ length: sections }).map((_, s) => (
        <Card key={s}>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: fieldsPerSection }).map((_, f) => (
              <div key={f} className="grid gap-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
