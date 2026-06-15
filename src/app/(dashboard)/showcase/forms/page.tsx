import { PageHeader } from "@/ui/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { FormsContent } from "./FormsContent"

export default function FormsShowcase() {
  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title="Forms" description="Every input type with validation and react-hook-form" />
      <FormsContent />
      <Card>
        <CardHeader>
          <CardTitle>Validation States</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Normal state</Label>
            <Input placeholder="Normal input" />
          </div>
          <div className="grid gap-2">
            <Label>With value</Label>
            <Input defaultValue="john@example.com" />
          </div>
          <div className="grid gap-2">
            <Label>Error state</Label>
            <Input
              aria-invalid="true"
              className="border-destructive focus-visible:ring-destructive"
              placeholder="Invalid input"
            />
            <p className="text-sm text-destructive">This field has an error</p>
          </div>
          <div className="grid gap-2">
            <Label>Disabled</Label>
            <Input disabled placeholder="Disabled input" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
