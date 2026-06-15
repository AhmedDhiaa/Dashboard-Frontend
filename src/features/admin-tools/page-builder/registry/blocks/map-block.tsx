"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import dynamic from "next/dynamic"
import { mapBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"

type MapBlockProps = z.infer<typeof mapBlock>

/**
 * UnifiedMap lives in `src/features/maps/` (sibling feature) AND wraps the
 * `@googlemaps/js-api-loader` library, which the no-static-heavy-import
 * ESLint rule blocks at top level. `next/dynamic` clears both:
 *   - sibling-feature imports become async (architectural validator OK)
 *   - the heavy library only loads when this block actually mounts
 */
const DynamicUnifiedMap = dynamic(
  () => import("@/features/maps/UnifiedMap").then(mod => ({ default: mod.UnifiedMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-[400px] w-full animate-pulse rounded-md bg-muted flex items-center justify-center"
        data-testid="map-loading"
      >
        <span className="text-sm text-muted-foreground">Loading map…</span>
      </div>
    ),
  },
)

const DEFAULT_CENTER = { lat: 33.3152, lng: 44.3661 } // Baghdad

const MapBlockRender: ComponentType<MapBlockProps> = ({ features, hidden }) => {
  if (hidden) return null
  return (
    <div className="h-[400px] w-full" data-block-type="map">
      <DynamicUnifiedMap
        center={DEFAULT_CENTER}
        zoom={10}
        features={{
          markers: features.markers ? { enabled: true } : undefined,
          boundaries: features.boundaries ? { enabled: true } : undefined,
          drawing: features.drawing ? { enabled: true } : undefined,
        }}
      />
    </div>
  )
}

export const mapBlockDefinition: BlockDefinition<MapBlockProps> = {
  type: "map",
  category: "data",
  displayName: { en: "Map", ar: "خريطة" },
  icon: "MapPin",
  description: { en: "Google Maps panel with markers / boundaries / drawing.", ar: "خريطة." },
  propsSchema: mapBlock,
  defaultProps: mapBlock.parse({
    id: "map-1",
    type: "map",
    dataSource: { type: "entity", entityName: "vehicle" },
    features: { markers: true, boundaries: false, drawing: false },
  }),
  Render: MapBlockRender,
  wraps: {
    componentPath: "src/features/maps/UnifiedMap.tsx",
    componentName: "UnifiedMap (via next/dynamic)",
  },
}
