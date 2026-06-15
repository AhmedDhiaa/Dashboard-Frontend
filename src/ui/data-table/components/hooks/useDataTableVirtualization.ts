/**
 * Data Table Virtualization Hook
 * Handles virtual scrolling setup and calculations
 */

import { useRef, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { Row } from "@tanstack/react-table"

interface UseDataTableVirtualizationProps<TData> {
  enabled: boolean
  showPagination: boolean
  rows: Row<TData>[]
  estimateSize: number
  overscan: number
  onScrollChange?: (isScrolled: boolean) => void
}

export function useDataTableVirtualization<TData>({
  enabled,
  showPagination,
  rows,
  estimateSize,
  overscan,
  onScrollChange,
}: UseDataTableVirtualizationProps<TData>) {
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Detect scroll for sticky header shadow
  useEffect(() => {
    const container = tableContainerRef.current
    if (!container || !onScrollChange) return

    const handleScroll = () => {
      onScrollChange(container.scrollTop > 0)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [onScrollChange])

  // Virtual scrolling setup (only when enabled and not paginated)

  const rowVirtualizer = useVirtualizer({
    count: enabled && !showPagination ? rows.length : 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    enabled: enabled && !showPagination,
  })

  const virtualRows = enabled && !showPagination ? rowVirtualizer.getVirtualItems() : []
  const totalSize = enabled && !showPagination ? rowVirtualizer.getTotalSize() : 0
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0

  return {
    tableContainerRef,
    rowVirtualizer,
    virtualRows,
    totalSize,
    paddingTop,
    paddingBottom,
  }
}
