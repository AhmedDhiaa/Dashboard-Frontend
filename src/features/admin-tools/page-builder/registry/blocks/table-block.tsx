"use client"

import type { ComponentType, ReactNode } from "react"
import type { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/design-system/primitives/table"
import { ConfigDrivenListPage } from "@/core/crud/components/ConfigDrivenListPage"
import { tableBlock } from "../../schema/block-schema"
import type { BlockDefinition } from "../block-registry"
import { useBlockData } from "../../renderer/useBlockData"

type TableBlockProps = z.infer<typeof tableBlock>

/**
 * Three branches — one per `dataSource.type`:
 *
 * - `entity`  : keeps using `ConfigDrivenListPage` so the entity registry
 *               provides service + columns + filters (no parallel
 *               implementation).
 * - `api`     : fetches via `useBlockData`, renders the result through the
 *               low-level `Table` primitive with the user-declared
 *               columns. itemsPath is unwrapped so an ABP `PagedResultDto`
 *               lands correctly.
 * - `swagger` : same as `api` after the proxy resolves the operationId.
 *
 * Hook stability: the entity branch returns BEFORE any hook is called, and
 * the api/swagger branch lives inside its own `<ApiSourceTable>` so the
 * hook order is stable per branch.
 */
const TableBlockRender: ComponentType<TableBlockProps> = ({ dataSource, hidden, columns }) => {
  if (hidden) return null
  if (dataSource.type === "entity") {
    return <ConfigDrivenListPage entityConfigName={dataSource.entityName} />
  }
  return <ApiSourceTable dataSource={dataSource} columns={columns} />
}

interface ApiSourceTableProps {
  dataSource: Exclude<TableBlockProps["dataSource"], { type: "entity" }>
  columns: TableBlockProps["columns"]
}

function ApiSourceTable({ dataSource, columns }: ApiSourceTableProps) {
  const { data, loading, error } = useBlockData(dataSource)

  if (loading) return <Skeleton className="h-48 w-full" data-testid="table-loading" />
  if (error) {
    return (
      <Card>
        <CardContent className="text-sm text-destructive">{error.message}</CardContent>
      </Card>
    )
  }

  const itemsPath = "itemsPath" in dataSource ? dataSource.itemsPath : undefined
  const items = extractItems(data, itemsPath)

  if (columns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No columns configured. Edit the block to add columns.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.field}>{col.label?.en ?? col.field}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                  No rows.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row, idx) => {
                const rowKey = readDotPath(row, "id")
                return (
                  <TableRow key={typeof rowKey === "string" || typeof rowKey === "number" ? rowKey : idx}>
                    {columns.map(col => (
                      <TableCell key={col.field}>{renderCell(readDotPath(row, col.field))}</TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function extractItems(payload: unknown, itemsPath: string | undefined): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (!payload || typeof payload !== "object") return []
  if (itemsPath) {
    const got = readDotPath(payload, itemsPath)
    if (Array.isArray(got)) return got as Record<string, unknown>[]
  }
  // ABP-style fallback: { items, totalCount }.
  const obj = payload as Record<string, unknown>
  if (Array.isArray(obj.items)) return obj.items as Record<string, unknown>[]
  if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[]
  return []
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

function renderCell(value: unknown): ReactNode {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  if (typeof value === "boolean") return value ? "✓" : "✗"
  return String(value)
}

export const tableBlockDefinition: BlockDefinition<TableBlockProps> = {
  type: "table",
  category: "data",
  displayName: { en: "Table", ar: "جدول" },
  icon: "Table",
  description: { en: "Paginated table with row actions, search, and filters.", ar: "جدول مرقّم." },
  propsSchema: tableBlock,
  defaultProps: tableBlock.parse({
    id: "table-1",
    type: "table",
    dataSource: { type: "entity", entityName: "order" },
    columns: [{ field: "id", type: "text-primary" }],
  }),
  Render: TableBlockRender,
  wraps: {
    componentPath: "src/core/crud/components/CRUDListPage.tsx",
    componentName: "CRUDListPage (entity) | Table primitive (api/swagger via useBlockData)",
  },
}
