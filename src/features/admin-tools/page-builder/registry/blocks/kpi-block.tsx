"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import { StatCard } from "@/ui/design-system/primitives/stat-card"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { kpiBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"
import { useBlockData } from "../../renderer/useBlockData"

type KpiBlockProps = z.infer<typeof kpiBlock>

/**
 * Reads the configured `dataSource` via `useBlockData`, then pulls the
 * single number from the response at the dot-path the block declares
 * (`valueField`). Format: `<prefix><number><suffix>`. Trend (when
 * `trendField` is set) lands under StatCard.description as a small
 * delta — the description slot is the only existing affordance on
 * StatCard for secondary metrics.
 */
const KpiBlockRender: ComponentType<KpiBlockProps> = ({
  label,
  prefix,
  suffix,
  valueField,
  trendField,
  dataSource,
  hidden,
}) => {
  const { data, loading, error } = useBlockData(dataSource)
  if (hidden) return null
  if (loading) return <Skeleton className="h-32 w-full" />
  if (error) {
    // Surface the error inside the card so the admin sees what broke
    // without falling into a global error boundary.
    return <StatCard title={label.en} value={`!  ${error.message}`} />
  }
  const valueRaw = readDotPath(data, valueField)
  const trendRaw = trendField ? readDotPath(data, trendField) : undefined
  const value = formatValue(valueRaw, prefix, suffix)
  const description = trendRaw !== undefined ? formatTrend(trendRaw) : undefined
  return <StatCard title={label.en} value={value} description={description} />
}

function readDotPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") return undefined
  const segments = path.split(".")
  let cursor: unknown = source
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== "object") return undefined
    cursor = (cursor as Record<string, unknown>)[seg]
  }
  return cursor
}

function formatValue(raw: unknown, prefix: string | undefined, suffix: string | undefined): string {
  if (raw === undefined || raw === null) return "—"
  const text = typeof raw === "number" ? raw.toLocaleString() : String(raw)
  return `${prefix ?? ""}${text}${suffix ?? ""}`
}

function formatTrend(raw: unknown): string {
  if (typeof raw !== "number") return String(raw)
  const sign = raw >= 0 ? "+" : ""
  return `${sign}${raw.toLocaleString()}`
}

export const kpiBlockDefinition: BlockDefinition<KpiBlockProps> = {
  type: "kpi",
  category: "data",
  displayName: { en: "KPI", ar: "مؤشّر" },
  icon: "Activity",
  description: { en: "Single-number KPI tile, fetched from a data source.", ar: "بطاقة مؤشّر." },
  propsSchema: kpiBlock,
  defaultProps: kpiBlock.parse({
    id: "kpi-1",
    type: "kpi",
    dataSource: { type: "entity", entityName: "order" },
    valueField: "totalCount",
    label: { en: "Orders", ar: "الطلبات" },
  }),
  Render: KpiBlockRender,
  wraps: {
    componentPath: "src/ui/design-system/primitives/stat-card.tsx",
    componentName: "StatCard (data via useBlockData)",
  },
}
