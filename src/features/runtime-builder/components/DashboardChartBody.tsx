"use client"

/**
 * Recharts body for the runtime-dashboard `ChartWidget`. Lifted out of
 * `DashboardView` so the entire recharts surface (~85 KB gz) is only paid for
 * when a chart widget actually mounts — `DashboardView` dynamic-imports this
 * with `ssr:false`, so it never lands in the `/runtime/dashboard/[id]` route's
 * first-load bundle (which is governed by the default 150 KB budget) and never
 * runs on the server.
 *
 * Sizing contract: the caller must wrap this in a div with an explicit height
 * and width (DashboardView uses a 220px-tall, full-width div) — the bare
 * `<ResponsiveContainer>` delegates sizing to that parent.
 */

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export interface DashboardChartDatum {
  name: string
  value: number
}

export default function DashboardChartBody({
  data,
  chartType,
}: {
  data: DashboardChartDatum[]
  chartType?: string
}): React.ReactNode {
  const ChartImpl = chartType === "line" ? LineChart : BarChart
  return (
    <ResponsiveContainer>
      <ChartImpl data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {chartType === "line" ? (
          <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} />
        ) : (
          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        )}
      </ChartImpl>
    </ResponsiveContainer>
  )
}
