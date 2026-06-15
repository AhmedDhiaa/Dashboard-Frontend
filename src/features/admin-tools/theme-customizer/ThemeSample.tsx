"use client"

/**
 * A rich, representative slice of the app used inside the before/after preview.
 *
 * Everything renders through design tokens (CSS custom properties), so the
 * parent wrapper's inline `style` (which pins `live` or `draft` token values)
 * fully controls the appearance. Every token GROUP is visibly exercised so the
 * compare is a real showcase: an app-bar, a mini sidebar (--sidebar*), Latin +
 * Arabic copy (font), every button variant & size, an input + select + disabled
 * field, a badge per status, two KPI tiles, a 5-bar chart (--chart-1..5), an
 * avatar, a dialog-style card, and a 3-row table with status badges.
 */

import { Bell, LayoutDashboard, Search, Settings, Users } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Badge } from "@/ui/design-system/primitives/badge"

export function ThemeSample(): React.ReactNode {
  return (
    <div className="space-y-4 overflow-hidden rounded-xl border border-border bg-background text-foreground">
      <AppBar />
      <div className="flex gap-3 px-3">
        <MiniSidebar />
        <div className="min-w-0 flex-1 space-y-4 pb-4">
          <Heading />
          <Buttons />
          <FormRow />
          <StatusBadges />
          <KpiAndChart />
          <DialogCard />
          <OrdersTable />
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- App bar */

function AppBar() {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2.5 text-card-foreground">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
          M
        </span>
        <span className="text-sm font-semibold">Dashboard</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground">
          <Bell className="h-4 w-4" />
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          AD
        </span>
      </div>
    </header>
  )
}

/* --------------------------------------------------------------- Sidebar */

const NAV = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: Users, label: "Employees", active: false },
  { icon: Settings, label: "Settings", active: false },
]

function MiniSidebar() {
  return (
    <nav
      className="hidden w-36 shrink-0 space-y-1 self-start rounded-xl border p-2 sm:block"
      style={{ background: "var(--sidebar)", color: "var(--sidebar-foreground)", borderColor: "var(--sidebar-border)" }}
    >
      {NAV.map(item => {
        const Icon = item.icon
        return (
          <span
            key={item.label}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium"
            style={
              item.active
                ? { background: "var(--sidebar-primary)", color: "var(--sidebar-primary-foreground)" }
                : undefined
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </span>
        )
      })}
    </nav>
  )
}

/* --------------------------------------------------------------- Heading */

function Heading() {
  return (
    <header className="space-y-1">
      <h3 className="text-lg font-semibold leading-tight">Quarterly overview</h3>
      <p className="text-sm text-muted-foreground">The quick brown fox jumps over the lazy dog.</p>
      <p dir="rtl" className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-arabic)" }}>
        مرحباً بك في لوحة التحكم — يظهر النص العربي بالخط المختار.
      </p>
    </header>
  )
}

/* --------------------------------------------------------------- Buttons */

function Buttons() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Primary</Button>
        <Button size="sm" variant="secondary">Secondary</Button>
        <Button size="sm" variant="outline">Outline</Button>
        <Button size="sm" variant="ghost">Ghost</Button>
        <Button size="sm" variant="success">Success</Button>
        <Button size="sm" variant="danger">Delete</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline">Small</Button>
        <Button variant="outline">Default</Button>
        <Button size="lg" variant="outline">Large</Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Form row */

function FormRow() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label className="sm:col-span-1">
        <span className="sr-only">Search records</span>
        <span className="pointer-events-none relative block">
          <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </span>
        <Input placeholder="Search records…" className="ps-8" />
      </label>
      <select
        aria-label="Status filter"
        className="h-10 rounded-[var(--input-radius,0.5rem)] border border-border bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
      >
        <option>All statuses</option>
        <option>Paid</option>
        <option>Pending</option>
      </select>
      <Input placeholder="Disabled" disabled />
    </div>
  )
}

/* ----------------------------------------------------------- Status badges */

function StatusBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Active</Badge>
      <Badge variant="success">Paid</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="destructive">Overdue</Badge>
      <Badge variant="info">Info</Badge>
      <Badge
        className="border-transparent"
        style={{ background: "color-mix(in oklch, var(--premium) 15%, transparent)", color: "var(--premium)" }}
      >
        Premium
      </Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  )
}

/* -------------------------------------------------------- KPI + mini chart */

function KpiAndChart() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Total revenue" value="$48.2k" delta="+12.4%" />
        <StatTile label="Open tickets" value="37" delta="-4 today" muted />
      </div>
      <MiniChart />
    </div>
  )
}

function StatTile({ label, value, delta, muted }: { label: string; value: string; delta: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 text-card-foreground">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none tabular-nums">{value}</p>
      <p className={`mt-1.5 text-xs font-medium ${muted ? "text-muted-foreground" : "text-success"}`}>{delta}</p>
    </div>
  )
}

const CHART_BARS = [
  { h: 60, c: "var(--chart-1)" },
  { h: 85, c: "var(--chart-2)" },
  { h: 45, c: "var(--chart-3)" },
  { h: 72, c: "var(--chart-4)" },
  { h: 95, c: "var(--chart-5)" },
]

function MiniChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 text-card-foreground">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Revenue by region</p>
      <div className="flex h-20 items-end gap-2">
        {CHART_BARS.map((bar, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${bar.h}%`, backgroundColor: bar.c }}
            title={`Series ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Dialog card */

function DialogCard() {
  return (
    <div className="rounded-[var(--dialog-radius,0.625rem)] border border-border bg-popover p-[var(--dialog-padding,1.25rem)] text-popover-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
          JD
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold">Confirm publish</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This dialog surface uses popover, accent, avatar and dialog tokens.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost">Cancel</Button>
        <Button size="sm">Publish</Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Orders table */

function OrdersTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="p-2.5 text-start font-medium">Order</th>
            <th className="p-2.5 text-start font-medium">Status</th>
            <th className="p-2.5 text-end font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          <TableRow id="#1042" status="Paid" variant="success" amount="$540" />
          <TableRow id="#1043" status="Pending" variant="warning" amount="$120" />
          <TableRow id="#1044" status="Overdue" variant="destructive" amount="$980" />
        </tbody>
      </table>
    </div>
  )
}

function TableRow({
  id,
  status,
  variant,
  amount,
}: {
  id: string
  status: string
  variant: "success" | "warning" | "destructive"
  amount: string
}) {
  return (
    <tr className="border-t border-border">
      <td className="p-2.5 font-mono text-xs">{id}</td>
      <td className="p-2.5">
        <Badge variant={variant}>{status}</Badge>
      </td>
      <td className="p-2.5 text-end font-mono tabular-nums">{amount}</td>
    </tr>
  )
}
