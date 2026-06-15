import { PageHeader } from "@/ui/layout/PageHeader"
import { Card, CardContent } from "@/ui/design-system/primitives/card"

export default function TypographyShowcase() {
  return (
    <div className="space-y-8">
      <PageHeader title="Typography" description="All text styles and heading levels" />
      <Card>
        <CardContent className="pt-6 space-y-6">
          {(
            [
              { tag: "h1", cls: "text-4xl font-bold", label: "Heading 1 — text-4xl font-bold" },
              { tag: "h2", cls: "text-3xl font-semibold", label: "Heading 2 — text-3xl font-semibold" },
              { tag: "h3", cls: "text-2xl font-semibold", label: "Heading 3 — text-2xl font-semibold" },
              { tag: "h4", cls: "text-xl font-medium", label: "Heading 4 — text-xl font-medium" },
              { tag: "h5", cls: "text-lg font-medium", label: "Heading 5 — text-lg font-medium" },
              { tag: "h6", cls: "text-base font-medium", label: "Heading 6 — text-base font-medium" },
            ] as const
          ).map(({ tag: Tag, cls, label }) => (
            <div key={Tag} className="border-b pb-4 last:border-0">
              <Tag className={cls}>{label}</Tag>
            </div>
          ))}
          <div className="space-y-3 border-b pb-4">
            <p className="text-base">Body text — text-base. The quick brown fox jumps over the lazy dog.</p>
            <p className="text-sm text-muted-foreground">Small muted — text-sm text-muted-foreground.</p>
            <p className="text-xs text-muted-foreground">Extra small — text-xs text-muted-foreground.</p>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-sm bg-muted px-3 py-2 rounded">Monospace — font-mono text-sm</p>
            <p className="italic text-muted-foreground">Italic — italic text-muted-foreground</p>
            <p className="font-bold">Bold — font-bold</p>
            <p className="underline text-primary">Underline link — underline text-primary</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
