"use client"

/**
 * Mega-page container — wires the sticky nav alongside every Section
 * (one Section per category). Each Section is lazy-mounted via
 * next/dynamic with `ssr: false` so the first paint stays snappy and the
 * sticky nav becomes interactive before any heavy widget chunks parse.
 */

import nextDynamic from "next/dynamic"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { useT } from "@/shared/config"
import { ShowcaseSection, StickyNav, SHOWCASE_SECTIONS } from "./_shared"

const SectionFallback = (
  <div className="space-y-3">
    <Skeleton className="h-10 w-1/3" />
    <Skeleton className="h-32 w-full" />
  </div>
)

const PrimitivesSection = nextDynamic(() => import("./_sections/PrimitivesSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const FormFieldsSection = nextDynamic(() => import("./_sections/FormFieldsSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const DataDisplaySection = nextDynamic(() => import("./_sections/DataDisplaySection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const FormLayoutsSection = nextDynamic(() => import("./_sections/FormLayoutsSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const DynamicListSection = nextDynamic(() => import("./_sections/DynamicListSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const CrudViewsSection = nextDynamic(() => import("./_sections/CrudViewsSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const MapTrackingSection = nextDynamic(() => import("./_sections/MapTrackingSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const DataTableSection = nextDynamic(() => import("./_sections/DataTableSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const FeedbackSection = nextDynamic(() => import("./_sections/FeedbackSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const SkeletonsSection = nextDynamic(() => import("./_sections/SkeletonsSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const LayoutSection = nextDynamic(() => import("./_sections/LayoutSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const ApplicationSection = nextDynamic(() => import("./_sections/ApplicationSection"), {
  ssr: false,
  loading: () => SectionFallback,
})
const WidgetsSection = nextDynamic(() => import("./_sections/WidgetsSection"), {
  ssr: false,
  loading: () => SectionFallback,
})

/**
 * Render order for the sections. The id drives both the anchor and the
 * `showcase.sections.<id>.*` translation keys, so titles/descriptions and the
 * sticky-nav labels all localize from one source and flip under RTL with the
 * rest of the dashboard shell.
 */
const SECTIONS = [
  { id: "primitives", Component: PrimitivesSection },
  { id: "form-fields", Component: FormFieldsSection },
  { id: "data-display", Component: DataDisplaySection },
  { id: "form-layouts", Component: FormLayoutsSection },
  { id: "dynamic-list", Component: DynamicListSection },
  { id: "crud-views", Component: CrudViewsSection },
  { id: "data-table", Component: DataTableSection },
  { id: "feedback", Component: FeedbackSection },
  { id: "skeletons", Component: SkeletonsSection },
  { id: "layout", Component: LayoutSection },
  { id: "application", Component: ApplicationSection },
  { id: "widgets", Component: WidgetsSection },
  { id: "map-tracking", Component: MapTrackingSection },
] as const

export function AllShowcaseContent() {
  const t = useT("showcase")
  const navItems = SHOWCASE_SECTIONS.map(s => ({ id: s.id, label: t(`sections.${s.id}.label`) }))
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_14rem]">
      <main className="min-w-0 space-y-12">
        {SECTIONS.map(({ id, Component }) => (
          <ShowcaseSection key={id} id={id} title={t(`sections.${id}.title`)} description={t(`sections.${id}.desc`)}>
            <Component />
          </ShowcaseSection>
        ))}
      </main>
      <aside className="row-start-1 lg:row-auto">
        <StickyNav items={navItems} />
      </aside>
    </div>
  )
}
