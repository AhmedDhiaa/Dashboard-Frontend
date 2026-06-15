"use client"

/**
 * DataTableSection — feature-rich `@/ui/data-table` variant.
 *
 * 10 rows of mock orders rendered through DataTable: sortable columns,
 * search box, export button, page-size selector, and column-toggle menu.
 * Each cell renderer exercises a different column-type (mono code, text,
 * badge status, boolean paid flag, formatted currency, formatted date).
 */

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/ui/design-system/primitives/badge"
import { DataTable, DataTableColumnHeader } from "@/ui/data-table/components"
import ShowcaseBlock from "../_shared/ShowcaseBlock"
import { MOCK_ORDERS, type MockOrder } from "../_shared/mock-data"

const STATUS_VARIANTS = {
  new: "info",
  "in-progress": "warning",
  completed: "success",
  cancelled: "destructive",
} as const

export default function DataTableSection() {
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
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.phone}</span>,
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
        cell: ({ row }) => <span className="text-end font-medium block">{row.original.total.toLocaleString()}</span>,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
    ],
    [],
  )

  return (
    <ShowcaseBlock
      title="@/ui/data-table"
      description="Sortable, filterable, paginated — every column-type renderer exercised."
    >
      <DataTable
        columns={columns}
        data={MOCK_ORDERS as unknown as MockOrder[]}
        searchKey="customer"
        searchPlaceholder="Search by customer…"
        exportFilename="showcase-orders"
        pageSize={5}
      />
    </ShowcaseBlock>
  )
}
