import { PageHeader } from "@/ui/layout/PageHeader"
import { Card, CardContent } from "@/ui/design-system/primitives/card"

const COLOR_TOKENS = [
  { name: "background", css: "bg-background", text: "text-foreground" },
  { name: "card", css: "bg-card", text: "text-card-foreground" },
  { name: "muted", css: "bg-muted", text: "text-muted-foreground" },
  { name: "primary", css: "bg-primary", text: "text-primary-foreground" },
  { name: "secondary", css: "bg-secondary", text: "text-secondary-foreground" },
  { name: "accent", css: "bg-accent", text: "text-accent-foreground" },
  { name: "success", css: "bg-success", text: "text-success-foreground" },
  { name: "warning", css: "bg-warning", text: "text-warning-foreground" },
  { name: "destructive", css: "bg-destructive", text: "text-destructive-foreground" },
  { name: "info", css: "bg-info", text: "text-info-foreground" },
] as const

const FONT_SIZES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"] as const
const RADIUS_TOKENS = ["sm", "md", "lg", "xl", "full"] as const

export default function TokensShowcase() {
  return (
    <div className="space-y-10">
      <PageHeader title="Design Tokens" description="All CSS custom properties rendered live" />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Color Palette</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {COLOR_TOKENS.map(({ name, css, text }) => (
            <div key={name} className={`rounded-lg p-4 ${css}`}>
              <p className={`text-sm font-medium ${text}`}>{name}</p>
              <p className={`text-xs mt-1 font-mono opacity-70 ${text}`}>--{name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Typography Scale</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {FONT_SIZES.map(size => (
              <div key={size} className="flex items-baseline gap-6 border-b pb-3 last:border-0">
                <span className="text-xs font-mono text-muted-foreground w-8">{size}</span>
                <p className={`text-${size} font-medium`}>The quick brown fox</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Border Radius</h2>
        <div className="flex gap-6 flex-wrap">
          {RADIUS_TOKENS.map(r => (
            <div key={r} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-16 bg-primary/20 border-2 border-primary/40 rounded-${r}`} />
              <span className="text-xs text-muted-foreground font-mono">rounded-{r}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Shadows</h2>
        <div className="flex gap-6 flex-wrap">
          {(["sm", "md", "lg", "xl"] as const).map(s => (
            <div key={s} className={`h-16 w-28 bg-card rounded-lg flex items-center justify-center shadow-${s}`}>
              <span className="text-xs font-mono text-muted-foreground">shadow-{s}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
