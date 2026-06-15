"use client"

/**
 * Charts showcase — canonical reference for the recharts container pattern.
 *
 * Recharts' `<ResponsiveContainer>` measures its immediate JSX parent on
 * mount. When the parent has no explicit height (e.g. bare `<CardContent>`
 * inside a CSS grid cell), the first measurement returns 0 and recharts
 * logs `The width(-1) and height(-1) of chart should be greater than 0`
 * repeatedly. The fix is structural — give the parent a stable size:
 *
 *   ✓  Good:  `<div className="h-60 w-full"><ResponsiveContainer width="100%" height="100%"> … </ResponsiveContainer></div>`
 *   ✓  Good:  `<div style={{ height: 220 }}><ResponsiveContainer> … </ResponsiveContainer></div>`
 *   ✗  Bad:   `<CardContent><ResponsiveContainer width="100%" height={240}> … </ResponsiveContainer></CardContent>`
 *
 * Setting `minHeight={1}` on ResponsiveContainer suppresses the warning but
 * does not give the chart a stable size — every chart in this repo's
 * `features/dashboard/components/**` follows the wrapper-div pattern instead.
 *
 * If you add a new chart anywhere in src/ and see the `width(-1)` warning,
 * the parent of your `<ResponsiveContainer>` is the issue, not the chart.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const lineData = [
  { month: "Jan", revenue: 4000, expenses: 2400 },
  { month: "Feb", revenue: 3000, expenses: 1398 },
  { month: "Mar", revenue: 6000, expenses: 2800 },
  { month: "Apr", revenue: 8000, expenses: 3908 },
  { month: "May", revenue: 5000, expenses: 4800 },
  { month: "Jun", revenue: 9000, expenses: 3800 },
]

const pieData = [
  { name: "Delivered", value: 400 },
  { name: "Pending", value: 300 },
  { name: "Cancelled", value: 100 },
  { name: "Processing", value: 200 },
]

const PIE_COLORS = ["var(--success)", "var(--warning)", "var(--destructive)", "var(--info)"]

const CHART_COLORS = {
  primary: "var(--primary)",
  secondary: "var(--secondary)",
}

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--card-foreground)",
  fontSize: "12px",
}

const axisProps = {
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  axisLine: false as const,
  tickLine: false as const,
}

export function ChartsContent() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Area Chart</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Explicit h-60 (=240px) on the wrapper so ResponsiveContainer measures
              a stably-sized parent on first paint. Without it, grid items report
              width=0 during initial layout and recharts logs "width(-1)" warnings.
              The chart fills the wrapper with width="100%" height="100%". */}
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData}>
                <defs>
                  <linearGradient id="cRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS.primary}
                  fill="url(#cRevenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bar Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lineData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Line Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke={CHART_COLORS.secondary}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pie / Donut Chart</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
