/**
 * Data Table Body Component
 * Extracted from DataTable to reduce complexity
 */

import { Fragment } from "react"
import { flexRender, type Row, type ColumnDef, type HeaderGroup } from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/design-system/primitives/table"
import { Skeleton } from "@/ui/design-system/primitives/skeleton"
import { cn } from "@/shared/utils"
import { DataTableEmptyState, type DataTableEmptyVariant } from "./DataTableEmptyState"

interface DataTableBodyProps<TData, TValue> {
  headerGroups: HeaderGroup<TData>[]
  rows: Row<TData>[]
  columns: ColumnDef<TData, TValue>[]
  isLoading: boolean
  onRowClick?: (row: TData) => void
  /** Fired on row hover — used to prefetch the row's detail so the click is instant. */
  onRowMouseEnter?: (row: TData) => void
  enableVirtualization: boolean
  showPagination: boolean
  virtualRows: Array<{ index: number; start: number; size: number }>
  paddingTop: number
  paddingBottom: number
  isScrolled: boolean
  tableContainerRef: React.RefObject<HTMLDivElement | null>
  t: (key: string) => string
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode
  /** Variant of the empty state to display when there are no rows. */
  emptyVariant?: DataTableEmptyVariant
  onClearFilters?: () => void
  onRetry?: () => void
}

// eslint-disable-next-line max-lines-per-function -- Table body with virtualization support and row rendering logic
export function DataTableBody<TData, TValue>({
  headerGroups,
  rows,
  columns,
  isLoading,
  onRowClick,
  onRowMouseEnter,
  enableVirtualization,
  showPagination,
  virtualRows,
  paddingTop,
  paddingBottom,
  isScrolled,
  tableContainerRef,
  t,
  renderSubComponent,
  emptyVariant = "empty",
  onClearFilters,
  onRetry,
}: DataTableBodyProps<TData, TValue>) {
  const renderRow = (row: Row<TData>) => (
    <Fragment key={row.id}>
      <TableRow
        data-state={row.getIsSelected() && "selected"}
        onClick={() => (renderSubComponent ? row.toggleExpanded() : onRowClick?.(row.original))}
        onMouseEnter={() => onRowMouseEnter?.(row.original)}
        className={cn(
          "smooth-transition",
          onRowClick || renderSubComponent ? "cursor-pointer" : "",
          row.getIsExpanded?.() && "bg-muted/40",
        )}
      >
        {row.getVisibleCells().map(cell => {
          const isActionsColumn = cell.column.id === "actions"
          return (
            <TableCell
              key={cell.id}
              className={cn("text-center", isActionsColumn && "sticky-column sticky-column-shadow")}
              style={isActionsColumn ? { insetInlineStart: 0, zIndex: 10 } : undefined}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          )
        })}
      </TableRow>
      {renderSubComponent && row.getIsExpanded?.() && (
        <TableRow className="bg-muted/20 hover:bg-muted/30">
          <TableCell colSpan={row.getVisibleCells().length} className="p-0">
            {renderSubComponent({ row })}
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )

  return (
    <div className="flex-1 overflow-hidden relative flex flex-col">
      <div
        className="flex-1 w-full overflow-auto datatable-container smooth-transition px-1"
        ref={tableContainerRef}
        aria-busy={isLoading}
      >
        {/* Inside DataTable the bounded `.datatable-container` (above) owns BOTH
            scroll axes, so the Table primitive's own wrapper must NOT trap the
            horizontal scroll on its full-height (overflow-y-visible) box — that
            put the X scrollbar below the fold. `overflow-x-visible` lets X
            overflow bubble to the bounded container, so its scrollbar sits at
            the visible bottom. Border/bg/shadow are dropped (the card provides them). */}
        <Table containerClassName="overflow-x-visible rounded-none border-0 bg-transparent shadow-none">
          <TableHeader
            className={cn(
              "sticky-header transition-all duration-300",
              isScrolled && "sticky-header-shadow bg-muted/95",
            )}
          >
            {headerGroups.map(headerGroup => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map(header => {
                  const isActionsColumn = header.column.id === "actions"
                  return (
                    <TableHead
                      key={header.id}
                      className={cn("text-center h-16", isActionsColumn && "sticky-corner sticky-column-shadow")}
                      style={{
                        width: header.getSize(),
                        ...(isActionsColumn && { insetInlineStart: 0, zIndex: 30 }),
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton rows mirror the real column count so loading reads as
              // "faster" than a centered spinner and the layout doesn't shift.
              Array.from({ length: 8 }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`} className="hover:bg-transparent border-none">
                  {columns.map((_col, colIdx) => (
                    <TableCell key={colIdx} className="text-center h-14">
                      <Skeleton className="h-4 w-full" />
                      {rowIdx === 0 && colIdx === 0 && <span className="sr-only">{t("common.loading_data")}</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows?.length ? (
              <>
                {enableVirtualization && !showPagination && paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} />
                  </tr>
                )}
                {enableVirtualization && !showPagination
                  ? virtualRows.map(virtualRow => {
                      const row = rows[virtualRow.index]
                      return row ? renderRow(row) : null
                    })
                  : rows.map(row => renderRow(row))}
                {enableVirtualization && !showPagination && paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            ) : (
              <TableRow className="hover:bg-transparent border-none">
                <TableCell colSpan={columns.length} className="h-96 text-center">
                  <DataTableEmptyState variant={emptyVariant} t={t} onClearFilters={onClearFilters} onRetry={onRetry} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
