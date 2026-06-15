"use client"

/**
 * Recharts-backed chart body for `WidgetRenderer`. Lifted out of the
 * renderer so the entire recharts surface (~85 KB gz) is only paid for
 * when a chart-category widget actually mounts. KPI/table/alert/map
 * widgets never trigger this chunk.
 *
 * The renderer wraps this component in `next/dynamic` with `ssr:false`,
 * so chart code never runs on the server either.
 *
 * RESPONSIVE-CONTAINER SIZING CONTRACT (read before adding a new chart):
 *   Recharts' `<ResponsiveContainer>` measures its immediate DOM parent
 *   with a ResizeObserver. If the parent reports width=0 or height=0 on
 *   the first measurement pass — which happens inside a CSS grid cell
 *   that sizes by content, or any flex column without `min-h-0` — the
 *   container computes width=-1 / height=-1 and recharts logs
 *   "The width(-1) and height(-1) of chart should be greater than 0".
 *
 *   Both `<ResponsiveContainer>` instances below use width="100%" and
 *   height="100%" — i.e. they delegate sizing to the caller. The caller
 *   MUST wrap us in a div with an explicit height (Tailwind: `h-60`,
 *   `h-[260px]`, etc.) AND a width path (typically `w-full` or a sized
 *   grid cell). `WidgetRenderer` does this via its outer `h-full w-full`
 *   chain.
 *
 *   New chart? Use the same pattern as the existing 18 in
 *   features/dashboard/components/**: a sized wrapper div + bare
 *   `<ResponsiveContainer width="100%" height="100%" minHeight={1}>`.
 *   The `minHeight={1}` floor is harmless when height resolves and
 *   suppresses transient -1 warnings during HMR.
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import type { WidgetBuilderSchema } from "@/shared/widgets/schema"

type ChartVisualization = Extract<WidgetBuilderSchema["visualization"], { type: "chart" }>

interface ChartBodyProps {
  visualization: ChartVisualization
  data: Record<string, unknown>[]
}

export default function ChartBody({ visualization, data }: ChartBodyProps): React.ReactNode {
  const colors = visualization.colors ?? ["var(--primary)"]
  const xKey = visualization.xAxis?.field
  const showXAxis = !!xKey

  if (visualization.chartType === "pie" || visualization.chartType === "donut") {
    const yField = visualization.yAxes[0]?.field ?? "value"
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={yField}
            nameKey={xKey ?? "name"}
            innerRadius={visualization.chartType === "donut" ? "55%" : 0}
            outerRadius="80%"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          {visualization.showLegend && <Legend />}
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const Chart =
    visualization.chartType === "line" ? LineChart : visualization.chartType === "area" ? AreaChart : BarChart

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        {showXAxis && <XAxis dataKey={xKey} fontSize={11} />}
        <YAxis fontSize={11} />
        <Tooltip />
        {visualization.showLegend && <Legend />}
        {visualization.yAxes.map((y, i) => {
          const color = colors[i % colors.length] ?? "var(--primary)"
          if (visualization.chartType === "line") {
            return <Line key={y.field} type="monotone" dataKey={y.field} stroke={color} dot={false} />
          }
          if (visualization.chartType === "area") {
            return (
              <Area
                key={y.field}
                type="monotone"
                dataKey={y.field}
                fill={color}
                stroke={color}
                stackId={visualization.stacked ? "1" : undefined}
              />
            )
          }
          return <Bar key={y.field} dataKey={y.field} fill={color} stackId={visualization.stacked ? "1" : undefined} />
        })}
      </Chart>
    </ResponsiveContainer>
  )
}
