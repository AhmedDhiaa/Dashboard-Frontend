"use client"

import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from "react"
import type { Table } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { Button } from "@/ui/design-system/primitives/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"
import { useT } from "@/shared/config"

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  totalCount?: number // REQUIRED for server-side pagination
  pageSizeOptions?: number[]
  showPageNumbers?: boolean
  maxVisiblePages?: number
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line max-lines-per-function -- Comprehensive pagination with page numbers, size selection, and navigation
export const DataTablePagination = memo(function DataTablePagination<TData>({
  table,
  totalCount,
  pageSizeOptions = [10, 20, 50, 100],
  showPageNumbers = true,
  maxVisiblePages = 7,
}: DataTablePaginationProps<TData>) {
  const t = useT("table")

  /* ------------------------------------------------------------------------ */
  /* Core Pagination State                                                     */
  /* ------------------------------------------------------------------------ */

  const { pageIndex, pageSize } = table.getState().pagination
  const [indexPage, setIndexPage] = useState(pageIndex)
  const currentPage = indexPage + 1 // Derive currentPage from indexPage
  const inputRef = useRef<HTMLInputElement>(null)

  const totalRows = typeof totalCount === "number" ? totalCount : table.getFilteredRowModel().rows.length

  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))

  const showingFrom = totalRows === 0 ? 0 : indexPage * pageSize + 1
  const showingTo = Math.min((indexPage + 1) * pageSize, totalRows)

  /* ------------------------------------------------------------------------ */
  /* RTL Support                                                               */
  /* ------------------------------------------------------------------------ */

  const isRTL = typeof document !== "undefined" && document.dir === "rtl"

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight
  const FirstIcon = isRTL ? ChevronsRight : ChevronsLeft
  const LastIcon = isRTL ? ChevronsLeft : ChevronsRight

  /* ------------------------------------------------------------------------ */
  /* Sync current page with pageIndex changes                                 */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    // Update input value when page changes externally
    if (inputRef.current) {
      inputRef.current.value = String(indexPage + 1)
    }
  }, [indexPage])

  /* ------------------------------------------------------------------------ */
  /* Page Window Logic                                                         */
  /* ------------------------------------------------------------------------ */

  const getPagesToShow = useCallback(
    (current: number, total: number) => {
      const pages: (number | "...")[] = []

      if (total <= maxVisiblePages) {
        for (let i = 1; i <= total; i++) pages.push(i)
        return pages
      }

      pages.push(1)

      const windowSize = maxVisiblePages - 2
      const half = Math.floor(windowSize / 2)

      let start = Math.max(2, current - half)
      let end = Math.min(total - 1, current + half)

      if (start <= 2) {
        start = 2
        end = Math.min(total - 1, start + windowSize - 1)
      }

      if (end >= total - 1) {
        end = total - 1
        start = Math.max(2, end - windowSize + 1)
      }

      if (start > 2) pages.push("...")

      for (let i = start; i <= end; i++) pages.push(i)

      if (end < total - 1) pages.push("...")

      pages.push(total)

      return pages
    },
    [maxVisiblePages],
  )

  const pagesToShow = useMemo(
    () => (showPageNumbers ? getPagesToShow(currentPage, pageCount) : []),
    [currentPage, pageCount, showPageNumbers, getPagesToShow],
  )

  /* ------------------------------------------------------------------------ */
  /* Navigation Handlers                                                       */
  /* ------------------------------------------------------------------------ */

  const handlePageChange = useCallback(
    (page: number) => {
      const targetPage = Math.max(0, Math.min(page - 1, pageCount - 1))
      setIndexPage(targetPage)
      // setPageIndex takes a PAGE INDEX (0,1,2…), not a row offset. The old
      // `targetPage * pageSize` made page 2 request skipCount = 10*pageSize.
      table.setPageIndex(targetPage)
    },
    [table, pageCount],
  )

  const handleInputPageChange = useCallback(
    (value: string) => {
      const page = Number(value)
      if (!isNaN(page) && page >= 1 && page <= pageCount) {
        handlePageChange(page)
      } else {
        // Reset to current page if invalid
        if (inputRef.current) {
          inputRef.current.value = String(currentPage)
        }
      }
    },
    [handlePageChange, pageCount, currentPage],
  )

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    // Pagination footer. Solid card surface to anchor it to the table
    // above (which also has bg-card now). No backdrop-blur — there's
    // no floating layer here, and blur on a non-floating surface is
    // just GPU work for no payoff.
    <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Info section — single inline phrase, no nested bordered pills.
            The previous design wrapped each number in a "chip" which made
            the line look like 3 buttons rather than a sentence. Plain
            numbers + muted prose is the typical enterprise table footer. */}
        <div className="text-xs text-muted-foreground text-center sm:text-start">
          {table.getFilteredSelectedRowModel().rows.length > 0 ? (
            <span>
              <span className="font-medium text-primary">{table.getFilteredSelectedRowModel().rows.length}</span>{" "}
              {t("of")} <span className="font-medium text-foreground">{totalRows.toLocaleString()}</span>{" "}
              {t("rows_selected")}
            </span>
          ) : (
            <span>
              {t("showing")}{" "}
              <span className="font-medium text-foreground">
                {showingFrom.toLocaleString()}–{showingTo.toLocaleString()}
              </span>{" "}
              {t("of")} <span className="font-medium text-foreground">{totalRows.toLocaleString()}</span> {t("results")}
            </span>
          )}
        </div>

        {/* Controls */}
        <div
          role="navigation"
          aria-label={t("a11y.pagination_nav")}
          className="flex flex-wrap items-center justify-center gap-3 sm:justify-end"
        >
          {/* Page-size selector — h-8 to match the iconSm nav buttons
              beside it. The label is hidden on mobile to give the
              navigation row room. */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">{t("rows_per_page")}</span>
            <Select
              value={`${pageSize}`}
              onValueChange={v => {
                table.setPageSize(Number(v))
              }}
            >
              <SelectTrigger className="h-8 w-[68px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map(size => (
                  <SelectItem key={size} value={`${size}`} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page number buttons — single row of pill-less buttons. The
              active page uses the `primary` variant (filled), inactive
              pages use `ghost`. No scale/shadow growth on the active
              page — at table density (50+ rows) a growing pagination
              button is a visual bounce, not a status. */}
          {showPageNumbers && pageCount > 1 && (
            <div className="flex items-center gap-0.5" role="group" aria-label={t("a11y.page_numbers")}>
              {pagesToShow.map((page, idx) => {
                if (page === "...") {
                  const isLeft = idx < pagesToShow.length / 2
                  const targetPage = isLeft
                    ? Math.max(1, currentPage - maxVisiblePages)
                    : Math.min(pageCount, currentPage + maxVisiblePages)
                  return (
                    <Button
                      key={`ellipsis-${idx}`}
                      variant="ghost"
                      size="iconSm"
                      onClick={() => handlePageChange(targetPage)}
                      aria-label={`Jump ${isLeft ? "backward" : "forward"} ${maxVisiblePages} pages`}
                    >
                      <span className="text-sm opacity-60">…</span>
                    </Button>
                  )
                }
                const isActive = page === currentPage
                return (
                  <Button
                    key={page}
                    size="iconSm"
                    variant={isActive ? "primary" : "ghost"}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`${isActive ? "Current page, " : ""}Page ${page}`}
                    className="text-xs font-medium"
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                )
              })}
            </div>
          )}

          {/* Navigation controls (first / prev / page-input / next / last).
              A single bordered container groups them visually so the
              user reads "this is the navigator". */}
          <div className="flex items-center rounded-md border border-border bg-background overflow-hidden">
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => {
                setIndexPage(0)
                table.setPageIndex(0)
              }}
              disabled={!table.getCanPreviousPage()}
              aria-label={t("a11y.first_page")}
              className="rounded-none"
            >
              <FirstIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => {
                setIndexPage(indexPage - 1)
                table.setPageIndex(indexPage - 1)
              }}
              disabled={!table.getCanPreviousPage()}
              aria-label={t("a11y.previous_page")}
              className="rounded-none border-s border-border"
            >
              <PrevIcon className="h-3.5 w-3.5" />
            </Button>

            <div className="flex items-center px-2.5 h-8 text-xs min-w-[64px] justify-center border-s border-border">
              <input
                ref={inputRef}
                type="number"
                min={1}
                max={pageCount}
                defaultValue={currentPage}
                aria-label={t("a11y.current_page")}
                className="w-7 text-center bg-transparent outline-none focus:text-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    handleInputPageChange((e.target as HTMLInputElement).value)
                    ;(e.target as HTMLInputElement).blur()
                  } else if (e.key === "Escape") {
                    if (inputRef.current) {
                      inputRef.current.value = String(currentPage)
                    }
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                onBlur={e => handleInputPageChange(e.target.value)}
              />
              <span className="mx-1 text-muted-foreground/60">/</span>
              <span className="text-muted-foreground">{pageCount}</span>
            </div>

            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => {
                setIndexPage(currentPage)
                table.setPageIndex(currentPage)
              }}
              disabled={currentPage === pageCount}
              aria-label={t("a11y.next_page")}
              className="rounded-none border-s border-border"
            >
              <NextIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => {
                setIndexPage(pageCount - 1)
                table.setPageIndex(pageCount - 1)
              }}
              disabled={currentPage === pageCount}
              aria-label={t("a11y.last_page")}
              className="rounded-none border-s border-border"
            >
              <LastIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}) as <TData>(props: DataTablePaginationProps<TData>) => React.ReactElement
