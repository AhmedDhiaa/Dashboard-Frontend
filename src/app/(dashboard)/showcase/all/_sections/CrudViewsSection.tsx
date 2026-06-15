"use client"

/**
 * CrudViewsSection — the config-driven CRUD list, the same rows rendered as a
 * data table OR a generic card grid, toggled live. This is the single most
 * important "what every entity gets for free" demo: a programmer adds an entity
 * config and both views come for free, no per-entity table/card code.
 */

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { DataTable, DataTableColumnHeader } from "@/ui/data-table/components"
import { EntityCardGrid } from "@/ui/crud/renderers/EntityCardGrid"
import type { ColumnMetadata } from "@/ui/crud/renderers/table-column-factory"
import { ViewToggle } from "@/ui/crud/components/ViewToggle"
import ShowcaseBlock from "../_shared/ShowcaseBlock"
import { MOCK_ORDERS, type MockOrder } from "../_shared/mock-data"

const STATUS_VARIANTS = {
  new: "info",
  "in-progress": "warning",
  completed: "success",
  cancelled: "destructive",
} as const

/** Card metadata — the SAME shape an entity config's `listColumns` uses. */
const CARD_COLUMNS: ColumnMetadata[] = [
  { field: "customer", label: "Customer", type: "text-primary" },
  { field: "code", label: "Code", type: "badge-code" },
  { field: "city", label: "City", type: "text-secondary" },
  { field: "total", label: "Total", type: "currency" },
  { field: "paid", label: "Paid", type: "boolean" },
  { field: "createdAt", label: "Created", type: "date" },
]

export default function CrudViewsSection() {
  const [view, setView] = useState<"table" | "card">("card")

  const columns = useMemo<ColumnDef<MockOrder>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        accessorKey: "customer",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
      },
      {
        accessorKey: "city",
        header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANTS[row.original.status]} className="capitalize">
            {row.original.status.replace("-", " ")}
          </Badge>
        ),
      },
      {
        accessorKey: "paid",
        header: "Paid",
        cell: ({ row }) =>
          row.original.paid ? (
            <CheckCircle2 className="h-4 w-4 text-success" aria-label="Paid" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" aria-label="Unpaid" />
          ),
      },
      {
        accessorKey: "total",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total (IQD)" />,
        cell: ({ row }) => <span className="block text-end font-medium">{row.original.total.toLocaleString()}</span>,
      },
    ],
    [],
  )

  return (
    <ShowcaseBlock
      title="Config-driven CRUD — Table ⇄ Cards"
      description="The same rows rendered as a data table or the generic card grid (EntityCardGrid), toggled live. Every entity gets BOTH views from its config — no per-entity table or card code."
    >
      <div className="mb-4 flex justify-end">
        <ViewToggle mode={view} onChange={setView} />
      </div>
      {view === "table" ? (
        <DataTable
          columns={columns}
          data={MOCK_ORDERS as unknown as MockOrder[]}
          searchKey="customer"
          searchPlaceholder="Search by customer…"
          exportFilename="showcase-orders"
          pageSize={6}
        />
      ) : (
        <EntityCardGrid
          columns={CARD_COLUMNS}
          data={MOCK_ORDERS as unknown as Array<Record<string, unknown>>}
          basePath="#"
          perms={{ canView: false, canUpdate: false, canDelete: false }}
        />
      )}
    </ShowcaseBlock>
  )
}
