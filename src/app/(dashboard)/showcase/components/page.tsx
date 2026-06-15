import { PageHeader } from "@/ui/layout/PageHeader"
import { ComponentsContent } from "./ComponentsContent"

export default function ComponentsShowcase() {
  return (
    <div className="space-y-8">
      <PageHeader title="Components" description="All UI primitives with every variant" />
      <ComponentsContent />
    </div>
  )
}
