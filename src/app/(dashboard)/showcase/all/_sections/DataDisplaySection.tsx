"use client"

/**
 * DataDisplaySection — read-only data surfaces.
 *
 * Covered: Avatar (grouped + with image fallback), Badge (status palette),
 * EnumBadge (rendered via plain Badge — the real EnumBadge needs an enum
 * provider this showcase isn't bootstrapping), StatCard, the table
 * primitive (semantic HTML table — see DataTableSection for the
 * @/ui/data-table feature-rich variant), and DashboardCard.
 */

import { Bell, BarChart3, Truck, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/ui/design-system/primitives/avatar"
import { Badge } from "@/ui/design-system/primitives/badge"
import { StatCard } from "@/ui/design-system/primitives/stat-card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/design-system/primitives/table"
import { DashboardCard } from "@/ui/application/DashboardCard"
import ShowcaseBlock from "../_shared/ShowcaseBlock"
import { MOCK_ORDERS, MOCK_PEOPLE, MOCK_STATS } from "../_shared/mock-data"

const STATUS_VARIANTS = {
  new: "info",
  "in-progress": "warning",
  completed: "success",
  cancelled: "destructive",
} as const

export default function DataDisplaySection() {
  return (
    <div className="space-y-6">
      <StatCardsBlock />
      <DashboardCardBlock />
      <AvatarsBlock />
      <StatusBadgesBlock />
      <TablePrimitiveBlock />
    </div>
  )
}

function StatCardsBlock() {
  const icons = [Bell, BarChart3, Truck, AlertCircle]
  return (
    <ShowcaseBlock title="StatCard grid" description="Mixed trends and variants — what a dashboard top-row looks like.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_STATS.map((stat, i) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            icon={icons[i]}
            trend={
              "trend" in stat && stat.trend ? { value: stat.trend.value, isPositive: stat.trend.isPositive } : undefined
            }
            variant={(["primary", "accent", "success", "warning"] as const)[i % 4]}
          />
        ))}
      </div>
    </ShowcaseBlock>
  )
}

function DashboardCardBlock() {
  return (
    <ShowcaseBlock title="DashboardCard" description="Premium glass-style card used on the home canvas.">
      <DashboardCard title="Today’s pulse" subtitle="Realtime" icon={BarChart3}>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Orders</p>
            <p className="text-2xl font-bold">124</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Revenue</p>
            <p className="text-2xl font-bold">12.4M</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Drivers</p>
            <p className="text-2xl font-bold">17</p>
          </div>
        </div>
      </DashboardCard>
    </ShowcaseBlock>
  )
}

function AvatarsBlock() {
  return (
    <ShowcaseBlock title="Avatar group" description="Stacked customers with name fallback.">
      <div className="flex items-center gap-6">
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {MOCK_PEOPLE.map(person => (
            <Avatar key={person.id} className="border-2 border-card">
              <AvatarFallback>{person.initials}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{MOCK_PEOPLE.length} customers</p>
      </div>
    </ShowcaseBlock>
  )
}

function StatusBadgesBlock() {
  return (
    <ShowcaseBlock title="Status badges" description="Semantic badge mapping for order-status enum values.">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_VARIANTS) as (keyof typeof STATUS_VARIANTS)[]).map(status => (
          <Badge key={status} variant={STATUS_VARIANTS[status]} className="capitalize">
            {status.replace("-", " ")}
          </Badge>
        ))}
      </div>
    </ShowcaseBlock>
  )
}

function TablePrimitiveBlock() {
  return (
    <ShowcaseBlock title="Table primitive" description="Semantic HTML table for short, static datasets.">
      <Table>
        <TableCaption>Latest 5 orders (showcase mock).</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-end">Total (IQD)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MOCK_ORDERS.slice(0, 5).map(order => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-xs">{order.code}</TableCell>
              <TableCell>{order.customer}</TableCell>
              <TableCell>{order.city}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANTS[order.status]} className="capitalize">
                  {order.status.replace("-", " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-end font-medium">{order.total.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ShowcaseBlock>
  )
}
