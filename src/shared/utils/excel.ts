/**
 * Excel Export Utility — dynamic ExcelJS import.
 *
 * ExcelJS is loaded on-demand only when the user triggers an export, never at
 * page load. The dynamic-import boundary is preserved end-to-end:
 *   - Lazy-loaded chunk (no first-load cost on routes that never export).
 *   - The `custom/no-static-heavy-import` ESLint rule blocks any future
 *     top-level `import "exceljs"` from leaking into a route's eager graph.
 *
 * Why ExcelJS instead of `xlsx` (SheetJS Community):
 *   - SheetJS Community has open CVEs (prototype pollution + ReDoS) and the
 *     maintainers do not ship patches to the npm package — fixes only go to
 *     the paid Pro offering. ExcelJS receives regular security maintenance
 *     and matches our export feature set (auto-filter, freeze rows, column
 *     widths).
 */

import type ExcelJSNamespace from "exceljs"
import { getNestedValue } from "./general"

export interface ExcelColumn {
  header: string
  accessorKey: string
  width?: number
}

export interface ExcelExportOptions<T = Record<string, unknown>> {
  filename?: string
  sheetName?: string
  columns: ExcelColumn[]
  data: T[]
  autoFilter?: boolean
  freezeHeader?: boolean
}

function formatCellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "string" || typeof value === "number") return value
  return String(value)
}

function calculateColumnWidth(header: string): number {
  return Math.max(10, Math.min(String(header || "").length * 1.2, 50))
}

export async function exportToExcel<T = Record<string, unknown>>({
  filename = "export",
  sheetName = "Sheet1",
  columns,
  data,
  autoFilter = true,
  freezeHeader = true,
}: ExcelExportOptions<T>): Promise<void> {
  // Dynamic import — ExcelJS only loaded when user triggers export.
  const ExcelJS: typeof ExcelJSNamespace = (await import("exceljs")).default ?? (await import("exceljs"))

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  // ExcelJS sets the header row + column widths in one shot via `columns`.
  // Using a derived `key` lets us pass rows as objects keyed by accessor.
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.accessorKey,
    width: col.width ?? calculateColumnWidth(col.header),
  }))

  for (const row of data) {
    const flattened: Record<string, string | number | boolean> = {}
    for (const col of columns) {
      flattened[col.accessorKey] = formatCellValue(getNestedValue(row, col.accessorKey))
    }
    worksheet.addRow(flattened)
  }

  if (autoFilter && data.length > 0) {
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: data.length + 1, column: columns.length },
    }
  }
  if (freezeHeader) {
    worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }]
  }

  // `writeBuffer` returns an ArrayBuffer (or a Buffer on Node); both wrap into
  // a Blob via the BlobPart contract without copy.
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

interface TableColumn {
  id?: string
  accessorKey?: string
  header?: unknown
}

interface TableRow<T = unknown> {
  original: T
}

export async function exportTableToExcel<T = Record<string, unknown>>(
  columns: TableColumn[],
  rows: TableRow<T>[],
  filename = "table-export",
): Promise<void> {
  const excelColumns: ExcelColumn[] = columns
    .filter(col => col.accessorKey && col.id !== "actions")
    .map(col => ({
      header:
        typeof col.header === "string"
          ? col.header
          : col.accessorKey
            ? col.accessorKey.charAt(0).toUpperCase() + col.accessorKey.slice(1)
            : col.id || "Column",
      accessorKey: col.accessorKey!,
    }))

  await exportToExcel({ filename, columns: excelColumns, data: rows.map(r => r.original) })
}
