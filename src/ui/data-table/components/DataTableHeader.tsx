/**
 * Data Table Header Component
 * Extracted from DataTable to reduce complexity
 */

import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/ui/design-system/primitives/dropdown-menu"
import { RefreshCw, Settings2, FileSpreadsheet, LayoutList, LayoutGrid, Rows3 } from "lucide-react"
import type { Table } from "@tanstack/react-table"
import type { ActionMode, Density } from "./hooks"

interface DataTableHeaderProps<TData> {
  table: Table<TData>
  searchKey?: string
  searchPlaceholder?: string
  onSearch: (value: string, table: Table<TData>) => void
  onRefresh?: () => void
  isLoading?: boolean
  showSearch?: boolean
  showExport?: boolean
  showColumnToggle?: boolean
  onExport: () => void
  actionMode: ActionMode
  onActionModeChange: (mode: ActionMode) => void
  density: Density
  onDensityChange: (density: Density) => void
  headerTitle?: string | React.ReactNode
  headerDescription?: string
  headerIcon?: React.ReactNode
  filters?: React.ReactNode
  actions?: React.ReactNode
  t: (key: string) => string
}

// ─── Sub-components ─────────────────────────────────────────────────────────
// Extracted to keep the main function's cyclomatic complexity under the
// project cap (15). Each piece composes a single conditional branch out of
// the parent, so the parent reads as a flat layout sketch instead of a
// nest of `&&` shortcuts.

function TitleBlock({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode
  title?: React.ReactNode
  description?: string
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5 shrink-0">
          {icon}
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0">
        {title && <h2 className="text-base font-semibold tracking-tight text-foreground truncate">{title}</h2>}
        {description && <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>}
      </div>
    </div>
  )
}

function ColumnToggleMenu<TData>({ table, t }: { table: Table<TData>; t: (key: string) => string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" className="text-muted-foreground" title={t("table.columns")}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto" sideOffset={5}>
        <div className="px-2 py-1.5 text-sm font-semibold border-b">{t("table.columns")}</div>
        {table
          .getAllColumns()
          .filter(column => column.getCanHide())
          .map(column => {
            const meta = column.columnDef.meta as { titleKey?: string } | undefined
            const translationKey = meta?.titleKey || "pages." + column.id.replace(/\./g, "_")
            const translated = t(translationKey)
            const columnId =
              translated !== translationKey
                ? translated
                : column.id
                    .replace(/\./g, " ")
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, l => l.toUpperCase())

            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={value => column.toggleVisibility(!!value)}
              >
                {columnId}
              </DropdownMenuCheckboxItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DensityMenu({
  density,
  onDensityChange,
  t,
}: {
  density: Density
  onDensityChange: (density: Density) => void
  t: (key: string) => string
}) {
  const levels: Density[] = ["compact", "normal", "comfortable"]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="iconSm" className="text-muted-foreground" title={t("table.density")}>
          <Rows3 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={5} className="w-44">
        <div className="px-2 py-1.5 text-sm font-semibold border-b">{t("table.density")}</div>
        {levels.map(level => (
          <DropdownMenuCheckboxItem
            key={level}
            checked={density === level}
            onCheckedChange={() => onDensityChange(level)}
          >
            {t(`table.density_${level}`)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DataTableHeader<TData>({
  table,
  searchKey,
  searchPlaceholder,
  onSearch,
  onRefresh,
  isLoading,
  showSearch,
  showExport,
  showColumnToggle,
  onExport,
  actionMode,
  onActionModeChange,
  density,
  onDensityChange,
  headerTitle,
  headerDescription,
  headerIcon,
  filters,
  actions,
  t,
}: DataTableHeaderProps<TData>) {
  const hasExtras = Boolean(filters || actions)
  return (
    <div className="px-5 py-4 border-b border-border bg-card">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <TitleBlock icon={headerIcon} title={headerTitle} description={headerDescription} />

        <div className="flex flex-wrap items-center gap-2">
          {showSearch && searchKey && (
            <div className="relative w-full sm:w-64 lg:w-56">
              <Input
                placeholder={searchPlaceholder || t("common.search")}
                value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                onChange={event => onSearch(event.target.value, table)}
                className="h-9 text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-1 ms-auto lg:ms-0">
            {onRefresh && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={onRefresh}
                disabled={isLoading}
                className="text-muted-foreground"
                title={t("common.refresh")}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            )}

            {showExport && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={onExport}
                className="text-muted-foreground"
                title={t("table.export_excel")}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => onActionModeChange(actionMode === "menu" ? "direct" : "menu")}
              className="text-muted-foreground"
              title={actionMode === "menu" ? t("table.switch_to_direct") : t("table.switch_to_menu")}
            >
              {actionMode === "menu" ? <LayoutGrid className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
            </Button>

            <DensityMenu density={density} onDensityChange={onDensityChange} t={t} />

            {showColumnToggle && <ColumnToggleMenu table={table} t={t} />}

            {hasExtras && <div className="w-px h-5 bg-border mx-1 hidden sm:block" />}
            {filters}
            {actions}
          </div>
        </div>
      </div>
    </div>
  )
}
