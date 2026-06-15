"use client"
// Uses useTheme() — must be a Client Component. Removing this directive
// crashes Server Component callers with "useTheme called from server".

import * as React from "react"
import { cn } from "@/shared/utils"
import { useTheme } from "@/ui/theme/ThemeManager"
import { resolveStyles, resolveInlineStyles } from "@/ui/theme/resolver"

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, containerClassName, ...props }, ref) => {
  const { settings } = useTheme()
  const componentId = "table"
  const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)
  const inline = resolveInlineStyles(componentId, settings?.components?.[componentId]?.elements)

  return (
    // Container is `overflow-x-auto overflow-y-visible` on purpose — vertical
    // scroll lives on a parent so the thead can stick to that scroll context.
    // If we set overflow-y here, sticky would compute against this wrapper
    // and fail when DataTable wraps us inside another scroll container.
    <div
      className={cn(
        "relative w-full overflow-x-auto overflow-y-visible rounded-xl border border-border bg-card shadow-sm",
        styles.root,
        containerClassName,
      )}
      style={{ ...inline, ...props.style }}
    >
      <table ref={ref} className={cn("w-full caption-bottom text-sm border-collapse", className)} {...props} />
    </div>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => {
    const { settings } = useTheme()
    const componentId = "table"
    const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)

    return (
      // Sticky top + opaque background. The opaque bg is required so rows
      // scrolling under the header don't show through; backdrop-blur is
      // kept as a *fallback hint* (supports-[backdrop-filter]) but the
      // solid muted is the primary surface — readability over flair.
      <thead
        ref={ref}
        className={cn(
          "sticky top-0 z-20 bg-muted border-b border-border",
          "supports-[backdrop-filter]:bg-muted/85 supports-[backdrop-filter]:backdrop-blur-md",
          styles.header,
          className,
        )}
        {...props}
      />
    )
  },
)
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
)
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("sticky bottom-0 z-10 border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  ),
)
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        // Zebra is handled in datatable-custom.css; per-row we just need
        // the bottom rule + hover affordance. No scale / translate — at
        // 50+ rows on screen, hover motion turns the page into a wave.
        "border-b border-border/60 transition-colors duration-150",
        "hover:bg-muted/40 data-[state=selected]:bg-primary/10",
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 text-start align-middle",
        // Semi-bold + uppercase-tracked is the canonical "column label"
        // pattern; the previous tracking-widest at text-xs degraded
        // legibility for short headers in Arabic.
        "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        "whitespace-nowrap",
        "[&_svg]:inline-block [&_svg]:size-3.5 [&_svg]:me-2 [&_svg]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => {
    const { settings } = useTheme()
    const componentId = "table"
    const styles = resolveStyles(componentId, {}, settings?.components?.[componentId]?.elements)

    return (
      <td
        ref={ref}
        className={cn("px-4 py-3 align-middle text-sm text-foreground/90", styles.cell, className)}
        {...props}
      />
    )
  },
)
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
)
TableCaption.displayName = "TableCaption"

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
