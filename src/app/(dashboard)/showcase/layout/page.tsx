import { PageHeader } from "@/ui/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"

export default function LayoutShowcase() {
  return (
    <div className="space-y-8">
      <PageHeader title="Layout" description="Responsive grid, sidebar states, mobile breakpoints" />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Responsive Grid</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">Card {i + 1}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Breakpoint Reference</h2>
        <Card>
          <CardHeader>
            <CardTitle>Current Breakpoint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="block sm:hidden text-warning font-medium">📱 Mobile (&lt; 640px)</p>
            <p className="hidden sm:block md:hidden text-info font-medium">📱 Small (640–767px)</p>
            <p className="hidden md:block lg:hidden text-primary font-medium">💻 Medium (768–1023px)</p>
            <p className="hidden lg:block xl:hidden text-success font-medium">🖥️ Large (1024–1279px)</p>
            <p className="hidden xl:block 2xl:hidden text-accent-foreground font-medium">🖥️ XL (1280–1535px)</p>
            <p className="hidden 2xl:block font-medium">🖥️ 2XL (≥ 1536px)</p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
