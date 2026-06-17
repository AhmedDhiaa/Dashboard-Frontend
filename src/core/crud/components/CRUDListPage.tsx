"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { useT } from "@/shared/config"
import { useDebounce } from "@/shared/hooks/useDebounce"
import type { ColumnDef } from "@tanstack/react-table"
import type { Row, SortingState } from "@tanstack/react-table"
import { Button } from "@/ui/design-system/primitives/button"
import { Plus, Filter } from "lucide-react"
import { useFilterDrawer, type FilterField } from "@/ui/application/FilterDrawer"
import type { CRUDListParams } from "@/infra/api"
import type { Page } from "@/shared/ports/backend"
import { useNotification } from "@/ui/application"
import { LazyDataTable } from "@/ui/data-table/components/lazy"
import { cn } from "@/shared/utils"
import { logger } from "@/shared/logger"

export interface CRUDListPageProps<TEntity extends { id: string | number }> {
  /** Service instance for API calls */
  service: {
    getList: (params?: CRUDListParams) => Promise<Page<TEntity>>
    delete: (id: string) => Promise<void>
    /** Optional — when present, hovering a row prefetches its detail. */
    getById?: (id: string) => Promise<TEntity>
  }
  /** Table column definitions */
  columns: ColumnDef<TEntity>[]
  /** Page title */
  title: string
  /** Page description */
  description?: string
  /** Icon component */
  icon?: React.ReactNode
  /** Entity name (singular, lowercase) for routes */
  entityName: string
  /** Search placeholder text */
  searchPlaceholder?: string
  /** Initial page size */
  defaultPageSize?: number
  /** Custom create route */
  createRoute?: string
  /** Disable create button */
  disableCreate?: boolean
  /** Additional action buttons to render alongside Create button */
  additionalActions?: React.ReactNode
  /** Column key to use for search filtering */
  searchKey?: string
  /** Override the ABP search param name (default "Term"; Role uses "Filter"). */
  searchParam?: string
  /** Filter fields for drawer */
  filterFields?: FilterField[]
  /** Callback when filters are applied */
  onFiltersApplied?: (filters: Record<string, unknown>) => void
  /** Callback when data changes (for external state management) */
  onDataChange?: (data: TEntity[]) => void
  /** Custom action buttons to render in the toolbar (in addition to additionalActions) */
  customActions?: React.ReactNode
  /** Custom view to render instead of the table */
  customView?: React.ReactNode
  /** Hide the default table */
  hideTable?: boolean
  /** Initial filter values */
  initialFilters?: Record<string, unknown>
  /** Render an expandable sub-component under each row */
  renderSubComponent?: (props: { row: Row<TEntity> }) => React.ReactNode
  /** Initial server-side sort — seeds the table indicator AND the first ABP `Sorting` param. */
  initialSort?: SortingState
}

// eslint-disable-next-line max-lines-per-function, complexity -- CRUD list page with table, pagination, search, filters, and bulk actions
export function CRUDListPage<TEntity extends { id: string | number }>({
  service,
  columns,
  title,
  description,
  icon,
  entityName,
  searchPlaceholder,
  searchParam,
  defaultPageSize = 10,
  createRoute,
  disableCreate = false,
  additionalActions,
  filterFields,
  onFiltersApplied,
  onDataChange,
  customActions,
  customView,
  hideTable = false,
  initialFilters,
  renderSubComponent,
  initialSort,
}: CRUDListPageProps<TEntity>) {
  const t = useT()
  const notifications = useNotification()
  const queryClient = useQueryClient()
  const { openFilters } = useFilterDrawer()
  const [pageNumber, setPageNumber] = useState(0)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [searchKey, setSearchKey] = useState("")
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(initialFilters || {})
  // Server-side sort state — seeded from the config's defaultSort. The table is
  // server-paginated, so TanStack's default (client-only, single-page) sort was
  // silently wrong; we drive ABP `Sorting` from here instead.
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? [])

  // Debounce the search box so typing doesn't fire one request per keystroke.
  const debouncedSearch = useDebounce(searchKey, 300)

  const params: CRUDListParams = useMemo(
    () => ({
      pageNumber,
      pageSize,
      ...(searchParam && { searchParam }),
      ...(debouncedSearch && { searchKey: debouncedSearch }),
      ...(sorting[0] && {
        sortBy: String(sorting[0].id),
        sortDirection: sorting[0].desc ? ("desc" as const) : ("asc" as const),
      }),
      ...activeFilters,
    }),
    [pageNumber, pageSize, searchParam, debouncedSearch, sorting, activeFilters],
  )

  // A header click re-sorts server-side: update `sorting` → new queryKey → refetch
  // with the new `Sorting`. Page index is intentionally preserved (no reset).
  const handleSortingChange = useCallback((next: SortingState) => {
    setSorting(next)
  }, [])

  // TanStack Query: cache keyed on entity + params, keeping the previous page
  // visible while the next loads — no skeleton flash, no row-clearing on
  // refetch, and request dedup across navigations.
  const {
    data,
    isLoading: isListLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: [entityName, "list", params],
    queryFn: () => service.getList(params),
    placeholderData: keepPreviousData,
  })

  const entities = useMemo(() => data?.items ?? [], [data])
  const totalCount = data?.totalCount ?? 0

  // Surface fetch errors as a toast WITHOUT clearing the visible rows.
  useEffect(() => {
    if (loadError) {
      notifications.error(loadError)
      logger.error(`Failed to load ${entityName}`, loadError)
    }
  }, [loadError, entityName, notifications])

  // Notify external consumers (tree/card views) when data changes.
  useEffect(() => {
    if (data) onDataChange?.(data.items)
  }, [data, onDataChange])

  // Optimistic delete with undo: remove the row from the cache immediately and
  // show an Undo toast. The actual API DELETE is deferred until the toast times
  // out (Undo cancels it); on API error the row is rolled back. Undo replaces
  // the old confirm dialog as the safety net.
  const handleDelete = useCallback(
    (id: string) => {
      const queryKey = [entityName, "list", params]
      const previous = queryClient.getQueryData<Page<TEntity>>(queryKey)

      // Optimistically drop the row from the active list cache.
      queryClient.setQueryData<Page<TEntity>>(queryKey, old =>
        old
          ? {
              ...old,
              items: old.items.filter(item => String(item.id) !== id),
              totalCount: Math.max(0, old.totalCount - 1),
            }
          : old,
      )

      notifications.undo("crud.messages.success_delete", {
        onUndo: () => {
          if (previous) queryClient.setQueryData(queryKey, previous)
        },
        onCommit: async () => {
          try {
            await service.delete(id)
            // Refetch so totalCount / pagination reconcile with the server.
            void queryClient.invalidateQueries({ queryKey: [entityName] })
          } catch (error: unknown) {
            if (previous) queryClient.setQueryData(queryKey, previous)
            notifications.error(error)
            logger.error(`Failed to delete ${entityName}`, error)
          }
        },
      })
    },
    [entityName, params, service, queryClient, notifications],
  )

  // Prefetch a row's detail on hover so the click into it is instant. Cached
  // under the SAME key the detail page reads (`[entity, "detail", id]`),
  // deduped and skipped while still fresh — so sweeping the mouse across the
  // table costs at most one fetch per distinct row.
  const handleRowPrefetch = useCallback(
    // The table hands rows back as the loose row shape; we only need `id`.
    (row: Record<string, unknown>) => {
      const getById = service.getById
      const id = row.id
      if (!getById || id == null) return
      const idStr = String(id)
      void queryClient.prefetchQuery({
        queryKey: [entityName, "detail", idStr],
        queryFn: () => getById(idStr),
        staleTime: 30_000,
      })
    },
    [entityName, service, queryClient],
  )

  // Add delete handler to columns if not already present
  const enhancedColumns = useMemo(() => {
    return columns.map(col => {
      if (col.id === "actions" && col.cell && typeof col.cell === "function") {
        const originalCell = col.cell
        return {
          ...col,
          cell: (props: import("@tanstack/react-table").CellContext<TEntity, unknown>) => {
            const enhancedProps = {
              ...props,
              onDelete: () => handleDelete(String(props.row.original.id)),
            }
            return originalCell(enhancedProps as import("@tanstack/react-table").CellContext<TEntity, unknown>)
          },
        }
      }
      return col
    })
  }, [columns, handleDelete])

  const filterButton = useMemo(
    () =>
      filterFields &&
      filterFields.length > 0 && (
        <Button
          onClick={() =>
            openFilters(
              {
                fields: filterFields,
                onApplyFilters: filters => {
                  setActiveFilters(filters)
                  onFiltersApplied?.(filters)
                },
                initialFilters: activeFilters,
              },
              t("Enum:filters:title_with_entity", { entity: title }),
            )
          }
          size="sm"
          variant="outline"
        >
          <Filter className="h-3.5 w-3.5 me-1.5" />
          {t("common.filter")}
          {Object.keys(activeFilters).filter(k => activeFilters[k]).length > 0 && (
            // Active-filter count badge — soft primary tint to match the
            // CTA in the same toolbar, no saturated success-green which
            // implied "all good" semantically for what is just a count.
            <span className="ms-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-medium rounded-full bg-primary/15 text-primary leading-none">
              {Object.keys(activeFilters).filter(k => activeFilters[k]).length}
            </span>
          )}
        </Button>
      ),
    [filterFields, activeFilters, openFilters, onFiltersApplied, t, title],
  )

  const createPath = createRoute || `/${entityName}/create/edit`

  // CRUDListPage filters server-side (via the `params` payload), so the
  // TanStack Table inside DataTable never sees `columnFilters` / `globalFilter`
  // populated. Tell DataTable explicitly when we have external filters active
  // so its "filtered-empty" variant can fire on a 0-row response.
  const hasExternalFilters =
    !!searchKey || Object.keys(activeFilters).some(k => activeFilters[k] !== undefined && activeFilters[k] !== "")

  return (
    <>
      <div className="h-full flex flex-col">
        {!hideTable && (
          <div
            className={cn(
              "flex-1 overflow-hidden transition-opacity",
              // Stale-while-revalidate: dim the kept-alive rows during a
              // background refetch (not the first load — that shows skeletons).
              isFetching && !isListLoading && "opacity-70",
            )}
          >
            <LazyDataTable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              columns={enhancedColumns as any} // Column type compatibility
              data={entities}
              searchKey={searchKey}
              searchPlaceholder={searchPlaceholder || `${t("common.search")} ${title.toLowerCase()}...`}
              onRefresh={() => void refetch()}
              onRowMouseEnter={handleRowPrefetch}
              onSearchChange={setSearchKey}
              onPaginationChange={(pageIndex, size) => {
                setPageNumber(pageIndex)
                setPageSize(size)
              }}
              onDeleteRow={handleDelete}
              isLoading={isListLoading}
              // Only show the destructive "couldn't load" empty-state when there
              // are no rows to fall back to; otherwise the toast covers it.
              loadError={entities.length === 0 ? loadError : null}
              hasExternalFilters={hasExternalFilters}
              totalCount={totalCount}
              manualPagination={true}
              manualSorting={true}
              currentSorting={sorting}
              onSortingChange={handleSortingChange}
              currentPageIndex={pageNumber}
              pageSize={pageSize}
              showPagination={!customView}
              showSearch={!customView || !hideTable}
              showColumnToggle={!customView}
              showExport={!customView}
              exportFilename={entityName}
              // Unified Header Props
              headerTitle={title}
              headerDescription={description}
              headerIcon={icon}
              // Expandable row support
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              renderSubComponent={renderSubComponent as any}
              // Action Buttons
              actions={
                <div className="flex items-center gap-2">
                  {customActions}
                  {additionalActions}
                  {!disableCreate && (
                    // Brand-primary CTA — the "add new record" is the
                    // canonical productive action on a list page, so it
                    // wears the brand colour. The previous `premium` +
                    // `shine` + `shadow-blue-600/20` combination read as a
                    // marketing pill (and used the premium violet token,
                    // a colour we reserve for special features).
                    <Button asChild size="sm" variant="primary">
                      <Link href={createPath} prefetch>
                        <Plus className="h-4 w-4 me-1.5" />
                        {t("crud.actions.add")}
                      </Link>
                    </Button>
                  )}
                </div>
              }
              // Filter Button
              filters={filterButton}
            />
          </div>
        )}

        {customView && (
          <div className={cn("flex-1", hideTable ? "overflow-y-auto" : "h-1/2 overflow-y-auto border-t")}>
            {/* If table is hidden, we still need the header from LazyDataTable or a manual header */}
            {hideTable && (
              <div className="p-4 md:p-6 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">
                      {title}
                    </h1>
                    {description && (
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                  {filterFields && filterButton}
                  <div className="flex-1 md:flex-none flex items-center gap-2 justify-end">
                    {customActions}
                    {additionalActions}
                  </div>
                  {!disableCreate && (
                    // Brand-primary CTA — matches the table branch above
                    // (no premium/shine/shadow marketing pill).
                    <Button asChild size="sm" variant="primary">
                      <Link href={createPath} prefetch>
                        <Plus className="h-4 w-4 me-1.5" />
                        <span className="hidden sm:inline">{t("crud.actions.add")}</span>
                        <span className="sm:hidden">{t("crud.actions.add_short") || t("crud.actions.add")}</span>
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
            {customView}
          </div>
        )}
      </div>
    </>
  )
}
