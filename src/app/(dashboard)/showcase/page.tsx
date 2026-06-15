import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Badge } from "@/ui/design-system/primitives/badge"
import { PageHeader } from "@/ui/layout/PageHeader"
import {
  Palette,
  Type,
  LayoutGrid,
  FormInput,
  Table2,
  Bell,
  BarChart3,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  ArrowRight,
} from "lucide-react"

const sections = [
  { title: "Design Tokens", href: "showcase/tokens", icon: Palette, desc: "Colors, typography, spacing, shadows" },
  { title: "Typography", href: "showcase/typography", icon: Type, desc: "All text styles and heading levels" },
  {
    title: "Components",
    href: "showcase/components",
    icon: LayoutGrid,
    desc: "Buttons, badges, cards, dialogs, dropdowns",
  },
  { title: "Forms", href: "showcase/forms", icon: FormInput, desc: "All input types, validation, react-hook-form" },
  {
    title: "Data Table",
    href: "showcase/table",
    icon: Table2,
    desc: "Sorting, filtering, pagination, export, mobile",
  },
  {
    title: "Feedback",
    href: "showcase/feedback",
    icon: Bell,
    desc: "Toasts, alerts, confirm dialogs, error states",
  },
  { title: "Charts", href: "showcase/charts", icon: BarChart3, desc: "All recharts variants with dark mode" },
  {
    title: "Full CRUD Entity",
    href: "showcase/widgets",
    icon: CheckCircle2,
    desc: "Complete list + edit + detail powered by config",
  },
  {
    title: "Skeletons",
    href: "showcase/skeletons",
    icon: Loader2,
    desc: "All loading states and skeleton variants",
  },
  {
    title: "Layout",
    href: "showcase/layout",
    icon: AlertTriangle,
    desc: "Responsive grid, sidebar states, mobile",
  },
  { title: "i18n", href: "showcase/i18n", icon: Info, desc: "EN/AR switching, RTL layout, plurals" },
  {
    title: "All in one",
    href: "showcase/all",
    icon: LayoutGrid,
    desc: "Every component on a single scrollable QA surface",
  },
] as const

export default function ShowcasePage() {
  return (
    <div>
      <PageHeader
        title="Component Showcase"
        description="Every UI component, pattern, and feature in one place. Only visible in development."
        badge={<Badge variant="warning">Dev Only</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ title, href, icon: Icon, desc }) => (
          <Link key={href} href={`/${href}`}>
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <CardDescription className="text-sm">{desc}</CardDescription>
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors"
                  aria-hidden="true"
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
