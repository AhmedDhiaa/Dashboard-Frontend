/**
 * Data Table Columns Hook
 * Handles column reordering and memoization
 */

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"

export function useDataTableColumns<TData, TValue>(columns: ColumnDef<TData, TValue>[]) {
  // Memoize columns with actions column moved to first position
  return useMemo(() => {
    // Find actions column index
    const actionsIndex = columns.findIndex(col => (col as unknown as Record<string, unknown>).id === "actions")
    // If actions column exists and is not already first, move it
    if (actionsIndex > 0) {
      const reorderedColumns = [...columns]
      const [actionsColumn] = reorderedColumns.splice(actionsIndex, 1)
      if (actionsColumn) {
        reorderedColumns.unshift(actionsColumn)
        return reorderedColumns
      }
    }

    return columns
  }, [columns])
}
