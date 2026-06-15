import { describe, it, expect } from "vitest"
import { createColumnsFromMetadata } from "@/ui/crud/renderers/table-column-factory"
import type { ColumnMetadata } from "@/ui/crud/renderers/table-column-factory"
import type { ColumnDef } from "@tanstack/react-table"

/**
 * The factory builds columns with `id` + `accessorFn` (NOT `accessorKey`) on
 * purpose: a silent `accessorFn` resolver avoids TanStack's per-cell dev-warning
 * flood on undefined nested paths (see table-column-factory.tsx). These tests
 * therefore assert the column `id` and that the `accessorFn` resolves the right
 * field value — the two guarantees callers actually depend on.
 */
type Row = Record<string, unknown> & { id: string | number }

/** Invoke a column's accessorFn against a sample row (mirrors what TanStack does). */
function accessorValue(col: ColumnDef<Row>, row: Row): unknown {
  const fn = (col as { accessorFn?: (r: Row, i: number) => unknown }).accessorFn
  return fn ? fn(row, 0) : undefined
}

describe("Table Column Factory", () => {
  describe("createColumnsFromMetadata", () => {
    it("should create columns from metadata", () => {
      const metadata: ColumnMetadata<Row>[] = [
        { field: "code", type: "badge-code" },
        { field: "name", type: "text-primary" },
        { field: "creationTime", type: "date" },
      ]

      const columns = createColumnsFromMetadata<Row>(metadata)

      expect(columns).toHaveLength(3)
      expect(columns[0]?.id).toBe("code")
      expect(columns[1]?.id).toBe("name")
      expect(columns[2]?.id).toBe("creationTime")
    })

    it("should handle badge-code type", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "code", type: "badge-code" }])
      expect(columns[0]?.id).toBe("code")
      expect(accessorValue(columns[0]!, { id: 1, code: "C-1" })).toBe("C-1")
    })

    it("should handle text-primary type", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "name", type: "text-primary" }])
      expect(columns[0]?.id).toBe("name")
      expect(accessorValue(columns[0]!, { id: 1, name: "Acme" })).toBe("Acme")
    })

    it("should handle text-secondary type", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "description", type: "text-secondary" }])
      expect(columns[0]?.id).toBe("description")
    })

    it("should handle text-arabic type", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "foreignName", type: "text-arabic" }])
      expect(columns[0]?.id).toBe("foreignName")
    })

    it("should handle date type", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "creationTime", type: "date" }])
      expect(columns[0]?.id).toBe("creationTime")
    })

    it("should handle badge type with config", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "status", type: "badge" }])
      expect(columns[0]?.id).toBe("status")
    })

    it("should handle boolean type", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "isActive", type: "boolean" }])
      expect(columns[0]?.id).toBe("isActive")
      expect(accessorValue(columns[0]!, { id: 1, isActive: true })).toBe(true)
    })

    it("resolves dotted field paths via accessorFn without throwing on missing segments", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "cityInfo.entity.name", type: "text-primary" }])
      expect(columns[0]?.id).toBe("cityInfo.entity.name")
      expect(accessorValue(columns[0]!, { id: 1, cityInfo: { entity: { name: "Baghdad" } } })).toBe("Baghdad")
      // Missing intermediate segment resolves to undefined, not a throw.
      expect(accessorValue(columns[0]!, { id: 2 })).toBeUndefined()
    })

    it("honours an explicit id override", () => {
      const columns = createColumnsFromMetadata<Row>([{ field: "name", id: "displayName", type: "text-primary" }])
      expect(columns[0]?.id).toBe("displayName")
    })

    it("should handle empty metadata array", () => {
      const columns = createColumnsFromMetadata<Row>([])
      expect(columns).toHaveLength(0)
    })

    it("should handle multiple columns of different types", () => {
      const metadata: ColumnMetadata<Row>[] = [
        { field: "code", type: "badge-code" },
        { field: "name", type: "text-primary" },
        { field: "description", type: "text-secondary" },
        { field: "foreignName", type: "text-arabic" },
        { field: "isActive", type: "boolean" },
        { field: "creationTime", type: "date" },
      ]

      const columns = createColumnsFromMetadata<Row>(metadata)
      expect(columns).toHaveLength(6)
    })
  })
})
