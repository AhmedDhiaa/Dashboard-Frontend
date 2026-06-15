import { PageHeader } from "@/ui/layout/PageHeader"
import { Card, CardContent } from "@/ui/design-system/primitives/card"

export default function TableShowcase() {
  return (
    <div className="space-y-8">
      <PageHeader title="Data Table" description="Sorting, filtering, pagination, export, mobile card view" />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Data table showcase — uses the config-driven entity system. See any entity list page (e.g. /areas) for a
            live example.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
