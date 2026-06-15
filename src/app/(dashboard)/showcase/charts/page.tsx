import { PageHeader } from "@/ui/layout/PageHeader"
import { ChartsContent } from "./ChartsContent"

export default function ChartsShowcase() {
  return (
    <div className="space-y-8">
      <PageHeader title="Charts" description="All recharts variants with OKLCH colors and dark mode" />
      <ChartsContent />
    </div>
  )
}
