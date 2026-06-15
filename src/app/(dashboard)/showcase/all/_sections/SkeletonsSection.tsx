"use client"

/**
 * SkeletonsSection — the four named skeleton variants used while async
 * surfaces are loading. Mirrors the existing showcase/skeletons sub-
 * page but inline, with each block labelled.
 */

import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"
import { DetailSkeleton } from "@/ui/skeletons/DetailSkeleton"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"
import { StatCardSkeleton } from "@/ui/skeletons/StatCardSkeleton"
import ShowcaseBlock from "../_shared/ShowcaseBlock"

export default function SkeletonsSection() {
  return (
    <div className="space-y-6">
      <ShowcaseBlock title="StatCardSkeleton" description="Four stat-card placeholders.">
        <StatCardSkeleton count={4} />
      </ShowcaseBlock>
      <ShowcaseBlock title="DataTableSkeleton" description="Search, table rows, and pagination placeholders.">
        <DataTableSkeleton />
      </ShowcaseBlock>
      <ShowcaseBlock title="FormSkeleton" description="Repeating form-field placeholders.">
        <FormSkeleton fields={4} />
      </ShowcaseBlock>
      <ShowcaseBlock title="DetailSkeleton" description="Section + field placeholders for detail/read views.">
        <DetailSkeleton sections={2} fieldsPerSection={4} />
      </ShowcaseBlock>
    </div>
  )
}
