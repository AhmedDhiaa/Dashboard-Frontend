/**
 * Table Column Factory
 *
 * Generates table column definitions from metadata to eliminate duplication.
 * Provides consistent column rendering across all CRUD list pages.
 */

"use client"

import type { ColumnDef, CellContext } from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { DataTableColumnHeader } from "@/core/data-table"
import { FieldRenderer, type FieldRendererType, type FieldVariant, type FieldFormatter } from "./field-renderers"
import type { FieldValue } from "@/types/field-types"
import { Edit, Trash2, View } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/ui/design-system/primitives/tooltip"
import { useTranslations } from "next-intl"

export interface ColumnMetadata<T = Record<string, FieldValue>> {
  field: keyof T | string
  id?: string
  type: FieldRendererType
  titleKey?: string
  label?: string
  sortable?: boolean
  width?: number | string
  className?: string
  action?: "edit" | "show" | "delete"
  requiredPermission?: string
  config?: {
    dateFormat?: string
    currencySymbol?: string
    relationDisplay?: string
    customRender?: (value: FieldValue, row: T) => React.ReactNode
    variant?: FieldVariant
    formatter?: FieldFormatter
    maxLength?: number
    enumType?: string
    enumLocale?: "en" | "ar"
    mapHeight?: string
    mapZoom?: number
  }
}

/**
 * Create table columns from metadata configuration
 *
 * @example
 * ```tsx
 * const columns = createColumnsFromMetadata<Brand>([
 *   { field: "code", type: "badge-code" },
 *   { field: "name", type: "text-primary" },
 *   { field: "foreignName", type: "text-arabic" },
 *   { field: "creationTime", type: "date" },
 * ])
 * ```
 */
/**
 * Resolve a (possibly dotted) field path off a row WITHOUT warning when an
 * intermediate segment is undefined. TanStack's deep `accessorKey` logs a dev
 * warning for every undefined nested access (e.g. an unassigned driver's
 * `salesPersonalInfo.entity.name`) — once PER CELL, PER RENDER. That flood of
 * `console.warn` during render (intercepted by the log forwarder) is a real
 * runtime cost and noise. Using an `accessorFn` with this silent resolver
 * removes it entirely while keeping the same value semantics.
 */
function resolveFieldPath<T>(row: T, path: string): FieldValue {
  if (!path.includes(".")) {
    return (row as Record<string, unknown>)?.[path] as FieldValue
  }
  let cursor: unknown = row
  for (const segment of path.split(".")) {
    if (cursor == null) return undefined as FieldValue
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return cursor as FieldValue
}

export function createColumnsFromMetadata<T extends { id: string | number }>(
  metadata: ColumnMetadata<T>[],
  basePath?: string,
): ColumnDef<T>[] {
  return metadata.map(meta => {
    const column: ColumnDef<T> = {
      id: meta.id || (meta.field as string),
      // Silent nested-path accessor (no per-cell dev warnings — see resolveFieldPath).
      accessorFn: (originalRow: T) => resolveFieldPath(originalRow, meta.field as string),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          titleKey={meta.titleKey || `pages.${String(meta.field).replace(/\./g, "_")}`}
        />
      ),
      meta: {
        titleKey: meta.titleKey || `pages.${String(meta.field).replace(/\./g, "_")}`,
      },
      cell: cellProps => {
        const { row } = cellProps
        const columnId = meta.id || (meta.field as string)
        const value = row.getValue(columnId) as FieldValue
        const entity = row.original

        // Handle explicit action buttons
        if (meta.type === "button" || meta.type === "action-button" || meta.action) {
          return <ActionColumnCell meta={meta} id={String(entity.id)} basePath={basePath} />
        }

        // Use custom renderer if provided
        if (meta.config?.customRender) {
          return <div className={meta.className}>{meta.config.customRender(value, entity)}</div>
        }

        // Use field renderer
        return (
          <div className={meta.className}>
            <FieldRenderer
              value={value}
              type={meta.type}
              config={{
                ...meta.config,
                customRender: undefined, // Exclude to avoid type mismatch
              }}
            />
          </div>
        )
      },
      enableSorting: meta.sortable !== false,
    }

    // Add width if specified
    if (meta.width) {
      column.size = typeof meta.width === "number" ? meta.width : undefined
    }

    return column
  })
}

/**
 * Create actions column for CRUD operations
 */
export function createActionsColumn<T extends { id: string | number }>(
  entityName: string,
  features?: { edit?: boolean; delete?: boolean; view?: boolean },
  basePath?: string,
): ColumnDef<T> {
  const routePath = basePath || `/${entityName}`
  return {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: (cellProps: CellContext<T, unknown> & { onDelete?: () => void }) => {
      const { row, onDelete } = cellProps
      return (
        <RowActionsCell routePath={routePath} id={String(row.original.id)} features={features} onDelete={onDelete} />
      )
    },
  }
}

/**
 * Row Actions Cell Component
 */
function RowActionsCell({
  routePath,
  id,
  features,
  onDelete,
}: {
  routePath: string
  id: string
  features?: { edit?: boolean; delete?: boolean; view?: boolean }
  onDelete?: () => void
}) {
  const router = useRouter()
  const t = useTranslations("common")

  return (
    <div className="flex items-center justify-center gap-1">
      <TooltipProvider delayDuration={300}>
        {features?.view !== false && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`${routePath}/${id}`)}
                className="h-8 w-8 text-accent hover:text-accent/90 hover:bg-accent/10 transition-all duration-200"
                aria-label="View"
              >
                <View className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("view")}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {features?.edit !== false && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`${routePath}/${id}/edit`)}
                className="h-8 w-8 text-secondary hover:text-secondary/90 hover:bg-warning/10 transition-all duration-200"
                aria-label="Edit"
              >
                <Edit className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("edit")}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {features?.delete !== false && onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={e => {
                  e.stopPropagation()
                  onDelete()
                }}
                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10 transition-all duration-200"
                aria-label="Delete"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("delete")}</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  )
}
/**
 * Action Column Cell Component - for individual button/icon columns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActionColumnCell<T extends { id: string | number } = any>({
  meta,
  id,
  basePath,
}: {
  meta: ColumnMetadata<T>
  id: string
  basePath?: string
}) {
  const router = useRouter()
  const t = useTranslations("common")

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const action = meta.action || (meta.field === "edit" ? "edit" : meta.field === "show" ? "show" : "show")

    // Determine path based on action
    // Note: This assumes standard routing. For more complex cases, use basePath from config.
    // However, createColumnsFromMetadata doesn't have basePath.
    // We'll try to guess or use window.location.pathname
    const currentPath = basePath || window.location.pathname.split("/").slice(0, 4).join("/")

    if (action === "edit") {
      router.push(`${currentPath}/${id}/edit`)
    } else if (action === "show") {
      router.push(`${currentPath}/${id}`)
    }
  }

  if (meta.type === "action-button") {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClick}>
        {meta.field === "edit" ? <Edit className="h-4 w-4 text-warning" /> : <View className="h-4 w-4 text-accent" />}
      </Button>
    )
  }

  return (
    <Button
      variant={meta.field === "edit" ? "warning" : "outline"}
      size="sm"
      className="h-8 text-[11px] font-bold px-3 transition-all active:scale-95"
      onClick={handleClick}
    >
      {meta.titleKey ? <span className="uppercase">{t(meta.titleKey)}</span> : String(meta.field)}
    </Button>
  )
}
