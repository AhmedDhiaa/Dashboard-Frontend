/**
 * Data Table State Management Hook
 * Extracts state management logic from DataTable component
 */

import { useState, useEffect, useCallback } from "react"
import type { SortingState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table"

export type ActionMode = "menu" | "direct"
export type Density = "compact" | "normal" | "comfortable"

interface UseDataTableStateProps {
  currentPageIndex?: number
  currentSorting?: SortingState
  initialPageSize: number
  onSortingChangeExternal?: (sorting: SortingState) => void
  onPaginationChange?: (pageIndex: number, pageSize: number) => void
  onSearchChange?: (value: string) => void
  searchKey?: string
  manualPagination?: boolean
}

interface UseDataTableStateReturn {
  // State
  sorting: SortingState
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  rowSelection: Record<string, boolean>
  pageIndex: number
  pageSize: number
  actionMode: ActionMode
  density: Density
  isScrolled: boolean

  // Setters
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>
  setRowSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setPageIndex: React.Dispatch<React.SetStateAction<number>>
  setPageSize: React.Dispatch<React.SetStateAction<number>>
  setActionMode: React.Dispatch<React.SetStateAction<ActionMode>>
  setDensity: React.Dispatch<React.SetStateAction<Density>>
  setIsScrolled: React.Dispatch<React.SetStateAction<boolean>>

  // Handlers
  handleSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void
  handlePaginationChange: (newPageIndex: number, newPageSize: number) => void
  handleSearchChange: <TData>(value: string, table?: import("@tanstack/react-table").Table<TData>) => void
}

// eslint-disable-next-line max-lines-per-function -- aggregates all data-table state (sorting, filters, pagination, selection, action-mode, density) with persistence
export function useDataTableState({
  currentPageIndex = 0,
  currentSorting = [],
  initialPageSize,
  onSortingChangeExternal,
  onPaginationChange,
  onSearchChange,
  searchKey,
  manualPagination = false,
}: UseDataTableStateProps): UseDataTableStateReturn {
  const [sorting, setSorting] = useState<SortingState>(currentSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pageIndex, setPageIndex] = useState(currentPageIndex ?? 0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [isScrolled, setIsScrolled] = useState(false)

  // Action mode state with localStorage persistence
  const [actionMode, setActionMode] = useState<ActionMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("datatable-action-mode")
      return (saved as ActionMode) || "menu"
    }
    return "menu"
  })

  // Persist action mode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("datatable-action-mode", actionMode)
    }
  }, [actionMode])

  // Row density state with localStorage persistence (mirrors actionMode)
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("datatable-density")
      if (saved === "compact" || saved === "normal" || saved === "comfortable") return saved
    }
    return "normal"
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("datatable-density", density)
    }
  }, [density])

  // Optimized callbacks with stable dependencies
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      setSorting(prevSorting => {
        const newSorting = typeof updater === "function" ? updater(prevSorting) : updater
        if (onSortingChangeExternal) {
          onSortingChangeExternal(newSorting)
        }
        return newSorting
      })
    },
    [onSortingChangeExternal],
  )

  const handlePaginationChange = useCallback(
    (newPageIndex: number, newPageSize: number) => {
      setPageIndex(newPageIndex)
      setPageSize(newPageSize)
      if (onPaginationChange) {
        onPaginationChange(newPageIndex, newPageSize)
      }
    },
    [onPaginationChange],
  )

  const handleSearchChange = useCallback(
    <TData>(value: string, table?: import("@tanstack/react-table").Table<TData>) => {
      if (searchKey && table) {
        table.getColumn(searchKey)?.setFilterValue(value)
      }
      if (onSearchChange) {
        onSearchChange(value)
      }
      // Reset to first page on search
      if (manualPagination && onPaginationChange) {
        setPageIndex(0)
        onPaginationChange(0, pageSize)
      }
    },
    [searchKey, onSearchChange, manualPagination, onPaginationChange, pageSize],
  )

  return {
    // State
    sorting,
    columnFilters,
    columnVisibility,
    rowSelection,
    pageIndex,
    pageSize,
    actionMode,
    density,
    isScrolled,

    // Setters
    setSorting,
    setColumnFilters,
    setColumnVisibility,
    setRowSelection,
    setPageIndex,
    setPageSize,
    setActionMode,
    setDensity,
    setIsScrolled,

    // Handlers
    handleSortingChange,
    handlePaginationChange,
    handleSearchChange,
  }
}
