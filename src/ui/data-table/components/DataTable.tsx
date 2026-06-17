"use client"
import { memo, useState, useMemo, useCallback, createContext, useContext } from "react"
import {
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Column,
  type ExpandedState,
  type Row,
  getExpandedRowModel,
} from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/ui/design-system/primitives/button"
import { useT } from "@/shared/config"
import { exportTableToExcel } from "@/shared/utils"
import { DataTablePagination } from "./DataTablePagination"
import { DataTableHeader } from "./DataTableHeader"
import { DataTableBody } from "./DataTableBody"
import {
  useDataTableState,
  useDataTableColumns,
  useDataTableConfig,
  useDataTableVirtualization,
  type ActionMode,
} from "./hooks"
import "./datatable-custom.css"

// Context for sharing action mode across table
interface DataTableContextValue {
  actionMode: ActionMode
}
const DataTableContext = createContext<DataTableContextValue>({ actionMode: "menu" })
export const useDataTableContext = () => useContext(DataTableContext)

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  onRowClick?: (row: TData) => void
  /** Fired on row hover — used to prefetch the row's detail so the click feels instant. */
  onRowMouseEnter?: (row: TData) => void
  onRefresh?: () => void
  isLoading?: boolean
  pageSize?: number
  showPagination?: boolean
  showPageNumbers?: boolean
  pageSizeOptions?: number[]
  showColumnToggle?: boolean
  showSearch?: boolean
  showExport?: boolean
  exportFilename?: string
  headerTitle?: string | React.ReactNode
  headerDescription?: string
  headerIcon?: React.ReactNode
  actions?: React.ReactNode
  filters?: React.ReactNode
  // Row actions
  onDeleteRow?: (id: string) => void
  // Server-side props
  manualPagination?: boolean
  manualSorting?: boolean
  manualFiltering?: boolean
  pageCount?: number
  totalCount?: number
  onPaginationChange?: (pageIndex: number, pageSize: number) => void
  onSortingChange?: (sorting: SortingState) => void
  onSearchChange?: (searchTerm: string) => void
  currentPageIndex?: number
  currentSorting?: SortingState
  // Virtual scrolling props
  enableVirtualization?: boolean
  estimateSize?: number // Estimated row height in px (default: 50)
  overscan?: number // Number of rows to render outside visible area (default: 5)
  // Expandable row support
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode
  /** When set, the empty state renders the "couldn't load data" variant with a Retry CTA. */
  loadError?: unknown
  /**
   * Server-side filter signal. TanStack's internal `columnFilters` /
   * `globalFilter` only see client-side filters, so callers that filter
   * via API params (CRUDListPage) must pass this flag explicitly so the
   * "filtered-empty" variant can fire on a 0-row response.
   */
  hasExternalFilters?: boolean
}

// eslint-disable-next-line complexity, max-lines-per-function -- Feature-rich data table with virtualization, sorting, filtering, and pagination
const DataTableComponent = memo(function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder,
  onRowClick,
  onRowMouseEnter,
  onRefresh,
  isLoading = false,
  pageSize: initialPageSize = 10,
  showPagination = true,
  showPageNumbers = true,
  pageSizeOptions = [10, 20, 50, 100],
  showColumnToggle = true,
  showSearch = true,
  showExport = true,
  exportFilename = "data",
  // headerTitle,
  // headerDescription,
  headerIcon,
  actions,
  filters,
  onDeleteRow,
  manualPagination = false,
  manualSorting = false,
  manualFiltering = false,
  pageCount: controlledPageCount,
  totalCount,
  onPaginationChange,
  onSortingChange: onSortingChangeExternal,
  onSearchChange,
  currentPageIndex = 0,
  currentSorting = [],
  enableVirtualization = false,
  estimateSize = 50,
  overscan = 5,
  renderSubComponent,
  loadError,
  hasExternalFilters = false,
}: DataTableProps<TData, TValue>) {
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const t = useT()

  // Extract state management to custom hook
  const {
    sorting,
    columnFilters,
    columnVisibility,
    rowSelection,
    pageIndex,
    pageSize,
    actionMode,
    density,
    isScrolled,
    setColumnFilters,
    setColumnVisibility,
    setRowSelection,
    setPageIndex,
    setPageSize,
    setActionMode,
    setDensity,
    setIsScrolled,
    handleSortingChange,
    handlePaginationChange,
    handleSearchChange,
  } = useDataTableState({
    currentPageIndex,
    currentSorting,
    initialPageSize,
    onSortingChangeExternal,
    onPaginationChange,
    onSearchChange,
    searchKey,
    manualPagination,
  })

  // Extract column management to custom hook
  const memoizedColumns = useDataTableColumns(columns)

  // Memoize data to prevent unnecessary re-renders
  const memoizedData = useMemo(() => data, [data])

  // Extract table configuration to custom hook
  const tableConfig = useDataTableConfig<TData>({
    data: memoizedData,
    columns: memoizedColumns,
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
    onSortingChange: handleSortingChange,
    setColumnFilters,
    setColumnVisibility,
    setRowSelection,
    setPageIndex,
    setPageSize,
    handlePaginationChange,
    onDeleteRow,
  })

  // Add expandable row model if renderSubComponent is provided
  const expandableConfig = useMemo(() => {
    if (!renderSubComponent) return tableConfig
    return {
      ...tableConfig,
      state: { ...tableConfig.state, expanded },
      onExpandedChange: setExpanded,
      getExpandedRowModel: getExpandedRowModel(),
    }
  }, [tableConfig, renderSubComponent, expanded])

  const table = useReactTable<TData>(expandableConfig)

  // Virtual scrolling setup (extracted to custom hook).
  // Auto-enable virtualization when pagination is off and the dataset is large
  // enough to benefit (>100 rows). This keeps small tables on the simple path.
  const rows = table.getRowModel().rows
  const effectiveVirtualization = enableVirtualization || (!showPagination && memoizedData.length > 100)
  const { tableContainerRef, virtualRows, paddingTop, paddingBottom } = useDataTableVirtualization({
    enabled: effectiveVirtualization,
    showPagination,
    rows,
    estimateSize,
    overscan,
    onScrollChange: setIsScrolled,
  })

  const exportToExcel = useCallback(() => {
    const filteredRows = table.getFilteredRowModel().rows
    // Type cast columns to match exportTableToExcel signature
    exportTableToExcel(
      memoizedColumns as unknown as Parameters<typeof exportTableToExcel>[0],
      filteredRows,
      exportFilename,
    )
  }, [memoizedColumns, table, exportFilename])

  // Determine the empty-state variant: error > filtered-empty > empty
  const globalFilter = table.getState().globalFilter as string | undefined
  const hasActiveFilters = useMemo(() => {
    if (hasExternalFilters) return true
    if (columnFilters?.length) return true
    if (typeof globalFilter === "string" && globalFilter.length > 0) return true
    return false
  }, [hasExternalFilters, columnFilters, globalFilter])

  const emptyVariant: "empty" | "filtered-empty" | "error" = loadError
    ? "error"
    : hasActiveFilters
      ? "filtered-empty"
      : "empty"

  const handleClearFilters = useCallback(() => {
    table.resetColumnFilters()
    table.setGlobalFilter("")
  }, [table])

  return (
    <DataTableContext.Provider value={{ actionMode }}>
      {/*
       * Outer shell: solid card surface + light shadow. Glass + heavy
       * shadow read as "marketing tile" — at table density (50+ rows
       * visible) the user is scanning, not admiring chrome. Sticky
       * header / sticky column live in this same scroll context.
       */}
      <div
        className={`density-${density} flex flex-col h-full bg-card rounded-xl overflow-hidden border border-border shadow-sm`}
      >
        <DataTableHeader
          table={table}
          searchKey={searchKey}
          searchPlaceholder={searchPlaceholder}
          onSearch={handleSearchChange}
          onRefresh={onRefresh}
          isLoading={isLoading}
          showSearch={showSearch}
          showExport={showExport}
          showColumnToggle={showColumnToggle}
          onExport={exportToExcel}
          actionMode={actionMode}
          onActionModeChange={setActionMode}
          density={density}
          onDensityChange={setDensity}
          // headerTitle={headerTitle}
          // headerDescription={headerDescription}
          headerIcon={headerIcon}
          filters={filters}
          actions={actions}
          t={t}
        />

        <DataTableBody
          headerGroups={table.getHeaderGroups()}
          rows={rows}
          columns={columns}
          isLoading={isLoading}
          onRowClick={onRowClick}
          onRowMouseEnter={onRowMouseEnter}
          enableVirtualization={effectiveVirtualization}
          showPagination={showPagination}
          virtualRows={virtualRows}
          paddingTop={paddingTop}
          paddingBottom={paddingBottom}
          isScrolled={isScrolled}
          tableContainerRef={tableContainerRef}
          t={t}
          renderSubComponent={renderSubComponent}
          emptyVariant={emptyVariant}
          onClearFilters={handleClearFilters}
          onRetry={onRefresh}
        />

        {showPagination && (
          <DataTablePagination
            table={table}
            totalCount={totalCount}
            pageSizeOptions={pageSizeOptions}
            showPageNumbers={showPageNumbers}
          />
        )}
      </div>
    </DataTableContext.Provider>
  )
})

DataTableComponent.displayName = "DataTable"

export const DataTable = DataTableComponent as <TData, TValue>(
  props: DataTableProps<TData, TValue>,
) => React.JSX.Element

export type { DataTableProps }

// Sortable column header component
export function DataTableColumnHeader<TData>({
  column,
  title,
  titleKey,
}: {
  column: Column<TData, unknown>
  title?: string
  titleKey?: string
}) {
  const t = useT()
  const displayTitle = titleKey ? t(titleKey) : title

  if (!column.getCanSort()) {
    return <div>{displayTitle}</div>
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-full font-semibold hover:bg-success/10 hover:text-success transition-all"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {displayTitle}
      <ArrowUpDown className="ltr:ms-2 rtl:me-2 h-4 w-4" />
    </Button>
  )
}
