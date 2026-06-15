import Link from "next/link"
import { LayoutGrid, Boxes, Blocks, FlaskConical, Palette, Languages, ArrowRight } from "lucide-react"
import { PageHeader } from "@/ui/layout/PageHeader"
import { Card } from "@/ui/design-system/primitives/card"
import { APP_NAME } from "@/shared/config/brand"

/**
 * Platform landing — a neutral, white-label overview. The config-driven CRUD
 * engine + the no-code builders are the product; this page points to the
 * example entities, the builders, and the component showcase. A buyer wires
 * their own dashboard widgets here (see /showcase/all → Widgets).
 */

const TILES = [
  { href: "/example", icon: Boxes, title: "Example entities", body: "Config-driven CRUD — list, cards, detail, edit, filters. See the Example UI entity." },
  { href: "/admin/entities", icon: Blocks, title: "Entity builder", body: "Define new entities from the UI — no code." },
  { href: "/admin/page-builder", icon: LayoutGrid, title: "Page builder", body: "Drag-and-drop pages from a block palette." },
  { href: "/admin/theme", icon: Palette, title: "Theme studio", body: "Live, token-based theming with instant preview." },
  { href: "/admin/translations", icon: Languages, title: "Translations", body: "Edit any string in-app, bilingual + RTL." },
  { href: "/showcase/all", icon: FlaskConical, title: "Component showcase", body: "Every primitive, field, layout, table, card and widget in one page." },
] as const

export default function HomePage() {
  return (
    <div className="space-y-8 pb-6">
      <PageHeader title={`${APP_NAME} Platform`} description="A config-driven admin platform. Pick an example entity or open a builder to get started." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(t => (
          <Card key={t.href} className="group flex flex-col gap-3 p-5 transition-shadow hover:shadow-md">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <t.icon className="size-5" />
            </span>
            <h3 className="text-base font-semibold text-foreground">{t.title}</h3>
            <p className="flex-1 text-sm text-muted-foreground">{t.body}</p>
            <Link
              href={t.href}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors group-hover:gap-2.5"
            >
              Open
              <ArrowRight className="size-4" />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
