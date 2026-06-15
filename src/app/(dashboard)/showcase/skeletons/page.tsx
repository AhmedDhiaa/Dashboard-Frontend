/* eslint-disable custom/require-entity-config */
import { PageHeader } from "@/ui/layout/PageHeader"
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"
import { DetailSkeleton } from "@/ui/skeletons/DetailSkeleton"
import { StatCardSkeleton } from "@/ui/skeletons/StatCardSkeleton"

function ShowcaseBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="rounded-lg border bg-card p-6">{children}</div>
    </div>
  )
}

export default function SkeletonsShowcase() {
  return (
    <div className="space-y-8">
      <PageHeader title="Skeletons" description="All loading state variants" />

      <ShowcaseBlock title="Stat Cards">
        <StatCardSkeleton count={4} />
      </ShowcaseBlock>

      <ShowcaseBlock title="Data Table">
        <DataTableSkeleton />
      </ShowcaseBlock>

      <ShowcaseBlock title="Form">
        <FormSkeleton fields={4} />
      </ShowcaseBlock>

      <ShowcaseBlock title="Detail View">
        <DetailSkeleton sections={2} fieldsPerSection={4} />
      </ShowcaseBlock>
    </div>
  )
}
