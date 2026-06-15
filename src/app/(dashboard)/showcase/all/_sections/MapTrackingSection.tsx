"use client"

/**
 * MapTrackingSection — the geo features of the platform.
 *
 * Shows the map as a SWAPPABLE provider: a live, key-less OpenStreetMap
 * (Leaflet) map plus the Google Maps option — "use this or that". Below it,
 * the coordinate/boundary field links to the working Example UI entity, and the
 * live-tracking feature is described in place.
 *
 * Fully localized (EN/AR) and RTL-safe (logical spacing, mirrored caret).
 */

import Link from "next/link"
import { MapPin, Navigation, ArrowRight, type LucideIcon } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"
import ShowcaseBlock from "../_shared/ShowcaseBlock"
import { MapProviderDemo } from "./MapProviderDemo"

export default function MapTrackingSection() {
  const t = useT("showcase")
  return (
    <ShowcaseBlock title={t("map.preview_label")} description={t("map.provider_hint")}>
      <div className="space-y-5">
        <MapProviderDemo />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FeatureCard
            icon={MapPin}
            title={t("map.boundary_title")}
            body={t("map.boundary_body")}
            cta={t("map.boundary_cta")}
            href="/example"
          />
          <FeatureCard icon={Navigation} title={t("map.tracking_title")} body={t("map.tracking_body")} />
        </div>
      </div>
    </ShowcaseBlock>
  )
}

/** Feature card; with `href` it links out, otherwise it's a static (inline) note. */
function FeatureCard({
  icon: Icon,
  title,
  body,
  cta,
  href,
}: {
  icon: LucideIcon
  title: string
  body: string
  cta?: string
  href?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      {href && cta && (
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href={href}>
            {cta}
            <ArrowRight className="ms-1.5 size-3.5 rtl:rotate-180" />
          </Link>
        </Button>
      )}
    </div>
  )
}
