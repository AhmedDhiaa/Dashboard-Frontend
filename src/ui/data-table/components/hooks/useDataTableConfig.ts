/**
 * useDataTableConfig Hook
 * Extracted from DataTable to reduce complexity
 * Handles table configuration setup with conditional features
 */

import { useMemo } from "react"
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type TableOptions,
} from "@tanstack/react-table"

interface UseDataTableConfigOptions<TData> {
  data: TData[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[]
  manualPagination?: boolean
  manualSorting?: boolean
  manualFiltering?: boolean
  controlledPageCount?: number
  sorting: SortingState
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  rowSelection: RowSelectionState
  pageIndex: number
  pageSize: number
  showPagination: boolean
  onSortingChange: OnChangeFn<SortingState>
  setColumnFilters: OnChangeFn<ColumnFiltersState>
  setColumnVisibility: OnChangeFn<VisibilityState>
  setRowSelection: OnChangeFn<RowSelectionState>
  setPageIndex: (index: number) => void
  setPageSize: (size: number) => void
  handlePaginationChange: (pageIndex: number, pageSize: number) => void
  onDeleteRow?: (id: string) => void
}

export function useDataTableConfig<TData>({
  data,
  columns,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  controlledPageCount,
  sorting,
  columnFilters,
  columnVisibility,
  rowSelection,
  pageIndex,
  pageSize,
  showPagination,
  onSortingChange,
  setColumnFilters,
  setColumnVisibility,
  setRowSelection,
  setPageIndex,
  setPageSize,
  handlePaginationChange,
  onDeleteRow,
}: UseDataTableConfigOptions<TData>): TableOptions<TData> {
  // Create pagination change handler
  const onPaginationChange: OnChangeFn<PaginationState> = useMemo(
    () => updater => {
      const newPagination = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater

      if (manualPagination) {
        handlePaginationChange(newPagination.pageIndex, newPagination.pageSize)
      } else {
        setPageIndex(newPagination.pageIndex)
        setPageSize(newPagination.pageSize)
      }
    },
    [manualPagination, pageIndex, pageSize, handlePaginationChange, setPageIndex, setPageSize],
  )

  // Build table configuration
  return useMemo<TableOptions<TData>>(
    () => ({
      data,
      columns,
      manualPagination,
      manualSorting,
      manualFiltering,
      pageCount: controlledPageCount ?? -1,
      onSortingChange,
      onColumnFiltersChange: setColumnFilters,
      onPaginationChange,
      getCoreRowModel: getCoreRowModel(),
      ...(!manualPagination && showPagination && { getPaginationRowModel: getPaginationRowModel() }),
      ...(!manualSorting && { getSortedRowModel: getSortedRowModel() }),
      ...(!manualFiltering && { getFilteredRowModel: getFilteredRowModel() }),
      onColumnVisibilityChange: setColumnVisibility,
      onRowSelectionChange: setRowSelection,
      meta: {
        onDelete: onDeleteRow,
      },
      state: {
        sorting,
        columnFilters,
        columnVisibility,
        rowSelection,
        pagination: {
          pageIndex: pageIndex ?? 0,
          pageSize: pageSize,
        },
      },
      initialState: {
        pagination: {
          pageIndex: 0,
          pageSize,
        },
      },
    }),
    [
      data,
      columns,
      manualPagination,
      manualSorting,
      manualFiltering,
      controlledPageCount,
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pageIndex,
      pageSize,
      showPagination,
      onSortingChange,
      setColumnFilters,
      onPaginationChange,
      setColumnVisibility,
      setRowSelection,
      onDeleteRow,
    ],
  )
}
