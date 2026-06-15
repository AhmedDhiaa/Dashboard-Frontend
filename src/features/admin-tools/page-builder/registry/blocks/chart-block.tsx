"use client"

import type { ComponentType } from "react"
import type { z } from "zod"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/ui/design-system/primitives/card"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { chartBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"
import { useBlockData } from "../../renderer/useBlockData"

type ChartBlockProps = z.infer<typeof chartBlock>

/**
 * Dynamic-load the recharts-backed ChartBody. This keeps ~85 KB gz of
 * recharts out of the static bundle — it only ships when a chart block
 * mounts. ssr:false matches the existing dashboard widget pattern.
 *
 * Static imports of `recharts` are blocked by the
 * `no-static-heavy-import` ESLint rule outside the project allowlist;
 * routing through `next/dynamic` is the supported escape hatch.
 */
const DynamicChartBody = dynamic(() => import("@/shared/widgets/ChartBody"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-muted" data-testid="chart-loading" />,
})

const ChartBlockRender: ComponentType<ChartBlockProps> = ({
  chartType,
  xAxis,
  yAxes,
  colors,
  showLegend,
  dataSource,
  hidden,
}) => {
  const { data, loading, error } = useBlockData(dataSource)
  if (hidden) return null

  // Page Builder schema includes 'radar' (per spec §3); WidgetBuilderSchema
  // does not yet — fall back to 'line' visually.
  const safeChartType =
    chartType === "radar" || chartType === "donut" ? "line" : (chartType as "line" | "bar" | "pie" | "area")

  if (yAxes.length === 0) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">No Y-axis configured.</CardContent>
      </Card>
    )
  }
  if (loading) return <Skeleton className="h-64 w-full" />
  if (error) {
    return (
      <Card>
        <CardContent className="text-sm text-destructive">{error.message}</CardContent>
      </Card>
    )
  }

  const seriesData = extractSeriesData(data)

  return (
    <div className="h-64 w-full" data-block-type="chart">
      <DynamicChartBody
        visualization={{
          type: "chart",
          chartType: safeChartType,
          xAxis: xAxis ? { field: xAxis.field } : undefined,
          yAxes: yAxes.map(y => ({ field: y.field })),
          colors: colors as `var(--${string})`[] | undefined,
          showLegend,
          stacked: false,
        }}
        data={seriesData}
      />
    </div>
  )
}

/**
 * Normalise the fetched payload into the row array recharts expects.
 * Three common shapes:
 *   - already an array: passed through
 *   - ABP `{ items, totalCount }`: pull `items`
 *   - generic `{ data: [...] }`: pull `data`
 */
function extractSeriesData(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[]
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[]
  }
  return []
}

export const chartBlockDefinition: BlockDefinition<ChartBlockProps> = {
  type: "chart",
  category: "data",
  displayName: { en: "Chart", ar: "رسم بياني" },
  icon: "BarChart",
  description: { en: "Recharts visualization (line / bar / pie / area / donut / radar).", ar: "رسم بياني." },
  propsSchema: chartBlock,
  defaultProps: chartBlock.parse({
    id: "chart-1",
    type: "chart",
    dataSource: { type: "entity", entityName: "order" },
    chartType: "line",
    yAxes: [{ field: "total" }],
  }),
  Render: ChartBlockRender,
  wraps: {
    componentPath: "src/shared/widgets/ChartBody.tsx",
    componentName: "ChartBody (recharts, via next/dynamic; data via useBlockData)",
  },
}
