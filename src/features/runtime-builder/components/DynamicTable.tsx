"use client"

/**
 * DynamicTable — auto-generates a CRUD table from a RuntimeEntity.
 *
 * Reads records reactively via useRuntimeList(), supports search and inline
 * delete, and emits row-click for navigation/edit. Sorting is local.
 */

import { useMemo, useState } from "react"
import { Pencil, Trash2, Search, Plus } from "lucide-react"
import type { RuntimeEntity, RuntimeField, RuntimeRecord } from "../types"
import { useRuntimeList, useRuntimeProvider } from "../store"
import { Input } from "@/ui/design-system/primitives/input"
import { Button } from "@/ui/design-system/primitives/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/design-system/primitives/table"
import { ConfirmDialog } from "@/ui/design-system/primitives/ConfirmDialog"

export interface DynamicTableProps {
  entity: RuntimeEntity
  onCreate?: () => void
  onEdit?: (record: RuntimeRecord) => void
}

type CellFormatter = (field: RuntimeField, value: unknown) => React.ReactNode

function formatCurrency(field: RuntimeField, value: unknown): React.ReactNode {
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  const code = field.currencyConfig?.currencyCode ?? "USD"
  const locale = field.currencyConfig?.locale
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(n)
  } catch {
    return `${code} ${n}`
  }
}

function formatSelect(field: RuntimeField, value: unknown): React.ReactNode {
  const opt = field.options?.find(o => o.value === value)
  return opt ? opt.label : String(value)
}

function formatMultiSelect(field: RuntimeField, value: unknown): React.ReactNode {
  if (!Array.isArray(value)) return String(value)
  return value.map(v => field.options?.find(o => o.value === v)?.label ?? String(v)).join(", ")
}

function formatColor(_field: RuntimeField, value: unknown): React.ReactNode {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full border border-border"
        style={{ backgroundColor: String(value) }}
      />
      <span className="font-mono text-xs">{String(value)}</span>
    </span>
  )
}

function formatFile(_field: RuntimeField, value: unknown): React.ReactNode {
  return value instanceof File ? value.name : String(value)
}

/**
 * Render a clickable anchor for url / mailto / tel cells. Kept as a regular
 * function (not a factory returning closures) so the `react/display-name`
 * lint rule doesn't flag the result as an anonymous component.
 */
function renderLink(value: unknown, hrefPrefix: string, wrap: boolean): React.ReactNode {
  const s = String(value)
  const className = wrap
    ? "text-primary hover:underline truncate inline-block max-w-[20ch]"
    : "text-primary hover:underline"
  return (
    <a
      href={hrefPrefix + s}
      target={wrap ? "_blank" : undefined}
      rel={wrap ? "noopener noreferrer" : undefined}
      className={className}
    >
      {s}
    </a>
  )
}

function formatBoolean(_field: RuntimeField, value: unknown): React.ReactNode {
  return value ? "Yes" : "No"
}

function formatStringish(_field: RuntimeField, value: unknown): React.ReactNode {
  return typeof value === "string" ? value : String(value)
}

function formatPercentage(_field: RuntimeField, value: unknown): React.ReactNode {
  return `${value}%`
}

function formatUrl(_field: RuntimeField, value: unknown): React.ReactNode {
  return renderLink(value, "", true)
}

function formatEmail(_field: RuntimeField, value: unknown): React.ReactNode {
  return renderLink(value, "mailto:", false)
}

function formatPhone(_field: RuntimeField, value: unknown): React.ReactNode {
  return renderLink(value, "tel:", false)
}

function formatTags(_field: RuntimeField, value: unknown): React.ReactNode {
  if (!Array.isArray(value)) return String(value)
  return value.map(String).join(", ")
}

// `enum` and `api-autocomplete` store the raw value the user picked; we
// don't have the fetched options at table-render time (they live in the
// per-row form). Display the value as-is — the table is a list view, not
// a full lookup display.
const CELL_FORMATTERS: Partial<Record<RuntimeField["type"], CellFormatter>> = {
  boolean: formatBoolean,
  date: formatStringish,
  datetime: formatStringish,
  time: formatStringish,
  currency: formatCurrency,
  percentage: formatPercentage,
  select: formatSelect,
  "multi-select": formatMultiSelect,
  color: formatColor,
  image: formatFile,
  file: formatFile,
  url: formatUrl,
  email: formatEmail,
  phone: formatPhone,
  tags: formatTags,
}

function formatCell(field: RuntimeField, value: unknown): React.ReactNode {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>
  return CELL_FORMATTERS[field.type]?.(field, value) ?? String(value)
}

// eslint-disable-next-line max-lines-per-function -- Single CRUD table surface, splitting hurts cohesion
export function DynamicTable({ entity, onCreate, onEdit }: DynamicTableProps) {
  const provider = useRuntimeProvider()
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<string | undefined>()
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [pendingDelete, setPendingDelete] = useState<RuntimeRecord | null>(null)

  const params = useMemo(() => ({ search, sortBy, sortDir }), [search, sortBy, sortDir])
  const { items, totalCount } = useRuntimeList(entity.id, params)

  const visibleFields = useMemo(() => {
    // Cap visible columns to avoid runaway tables when an entity has 50 fields.
    // Keep title fields first, then everything else, then trim.
    const sorted = [...entity.fields].sort((a, b) => Number(b.isTitle ?? 0) - Number(a.isTitle ?? 0))
    return sorted.slice(0, 6)
  }, [entity.fields])

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(key)
      setSortDir("asc")
    }
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    provider.remove(entity.id, pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${entity.pluralName.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        {onCreate && (
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add {entity.singularName}
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {visibleFields.map(f => (
              <TableHead key={f.key} onClick={() => toggleSort(f.key)} className="cursor-pointer select-none">
                {f.label}
                {sortBy === f.key && <span className="ms-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </TableHead>
            ))}
            <TableHead className="w-24 text-end">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleFields.length + 1} className="py-8 text-center text-muted-foreground">
                {search ? "No records match your search." : `No ${entity.pluralName.toLowerCase()} yet.`}
              </TableCell>
            </TableRow>
          ) : (
            items.map(record => (
              <TableRow key={record.id} className="hover:bg-muted/40">
                {visibleFields.map(f => (
                  <TableCell key={f.key}>{formatCell(f, record[f.key])}</TableCell>
                ))}
                <TableCell className="text-end">
                  <div className="inline-flex gap-1">
                    {onEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(record)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDelete(record)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <p className="text-xs text-muted-foreground">
        {totalCount} {totalCount === 1 ? entity.singularName : entity.pluralName}
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={open => !open && setPendingDelete(null)}
        title={`Delete ${entity.singularName}?`}
        description="This action cannot be undone. The record will be permanently removed."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
