/**
 * Unified entity-management table — Server Component.
 *
 * Three row shapes are mutually exclusive:
 *
 *   ┌──────────────────┬──────────────────────────┬────────────────────────┐
 *   │ Source           │ Status                   │ Actions                │
 *   ├──────────────────┼──────────────────────────┼────────────────────────┤
 *   │ Static + parses  │ Convertible from UI      │ <EditFieldsButton>     │
 *   │ Static + refuses │ Source-only (with reason)│ Open in editor (file:)│
 *   │ Runtime          │ Editable                 │ Edit (/builder?…)      │
 *   └──────────────────┴──────────────────────────┴────────────────────────┘
 *
 * No client JS in this component — badges are styled divs, the refusal
 * tooltip is a native `title` attribute, and the only hydrated leaf is
 * <EditFieldsButton>. Result: the entire table ships as inert HTML.
 *
 * Sort order is deterministic: alphabetical by id. Aligns with the
 * convertibility-report doc so cross-referencing is easy.
 */

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { EditFieldsButton, type ConvertActionFn } from "./EditFieldsButton"
import { RestoreConvertButton, type RestoreActionFn } from "./RestoreConvertButton"
import type { ParseResult } from "@/features/admin-tools/entity-converter/server/parse-static-config"

export interface EntityTableRow {
  id: string
  /** Display name; falls back to id when registry has no singularName. */
  displayName: string
  source: "static" | "runtime"
  /** Present for `source: "static"` — convert-parser verdict. */
  parse?: ParseResult
  /** Absolute filesystem path; only set for static rows. The `vscode://file`
   *  link uses this verbatim. */
  absoluteSourcePath?: string
  /** Only set for `source: "runtime"` when a successful convert
   *  snapshot still exists on disk — enables the "Restore from source"
   *  affordance. Undefined when the entity was created in the runtime
   *  builder directly (no static origin to restore to). */
  restoreBackupId?: string
}

export interface EntityTableProps {
  rows: EntityTableRow[]
  /** Server Action injected from the route page — see EditFieldsButton. */
  convertAction: ConvertActionFn
  /** Server Action injected from the route page — see RestoreConvertButton. */
  restoreAction: RestoreActionFn
}

export function EntityTable({ rows, convertAction, restoreAction }: EntityTableProps): React.ReactNode {
  return (
    <section className="border border-border rounded-md overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div>
          <h2 className="text-sm font-semibold">Entities</h2>
          <p className="text-xs text-muted-foreground">
            {rows.length} total &mdash; {rows.filter(r => r.source === "runtime").length} runtime,{" "}
            {rows.filter(r => r.source === "static").length} static
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/builder">
            <Plus className="h-4 w-4" />
            Create new
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground bg-muted/10">
            <tr>
              <th className="text-start font-medium px-4 py-2 w-1/3">Name</th>
              <th className="text-start font-medium px-4 py-2 w-24">Source</th>
              <th className="text-start font-medium px-4 py-2">Status</th>
              <th className="text-end font-medium px-4 py-2 w-44">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <Row
                key={`${row.source}:${row.id}`}
                row={row}
                convertAction={convertAction}
                restoreAction={restoreAction}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Row({
  row,
  convertAction,
  restoreAction,
}: {
  row: EntityTableRow
  convertAction: ConvertActionFn
  restoreAction: RestoreActionFn
}): React.ReactNode {
  const shape = classifyRow(row)
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2.5">
        <div className="font-medium">{row.displayName}</div>
        <code className="text-[11px] text-muted-foreground">{row.id}</code>
      </td>
      <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">{row.source}</td>
      <td className="px-4 py-2.5">
        <StatusBadge shape={shape} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          <RowActions row={row} shape={shape} convertAction={convertAction} restoreAction={restoreAction} />
        </div>
      </td>
    </tr>
  )
}

type RowShape = { kind: "static-convertible" } | { kind: "static-refused"; reason: string } | { kind: "runtime" }

function classifyRow(row: EntityTableRow): RowShape {
  if (row.source === "runtime") return { kind: "runtime" }
  // A static row whose parser refused — reason carries the UI tooltip.
  if (row.parse && !row.parse.ok) return { kind: "static-refused", reason: row.parse.reason }
  return { kind: "static-convertible" }
}

function StatusBadge({ shape }: { shape: RowShape }): React.ReactNode {
  // Hand-styled spans rather than the design-system <Badge>: Badge pulls
  // useTheme + the theme resolver as a client island, costing ~3KB
  // hydration per badge. A static span with token classes renders inert.
  if (shape.kind === "static-convertible") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-info/15 text-info-foreground border border-info/30">
        Convertible from UI
      </span>
    )
  }
  if (shape.kind === "static-refused") {
    return (
      <span
        title={shape.reason}
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-muted text-muted-foreground border border-border cursor-help"
      >
        Source-only
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-success/15 text-success-foreground border border-success/30">
      Editable
    </span>
  )
}

function RowActions({
  row,
  shape,
  convertAction,
  restoreAction,
}: {
  row: EntityTableRow
  shape: RowShape
  convertAction: ConvertActionFn
  restoreAction: RestoreActionFn
}): React.ReactNode {
  if (shape.kind === "static-convertible") {
    return <EditFieldsButton entityName={row.id} action={convertAction} />
  }
  if (shape.kind === "static-refused") {
    // vscode://file/<absolute> opens the source in VSCode when the admin
    // has the protocol handler registered. Outside VSCode the click is a
    // no-op — never breaks anything, just doesn't go anywhere useful.
    const path = row.absoluteSourcePath ?? ""
    return (
      <a
        href={`vscode://file/${path}`}
        className="text-xs text-primary hover:underline"
        title={`Open ${path} in your editor`}
      >
        Open in editor
      </a>
    )
  }
  // Runtime row: always offer Edit; surface Restore when a paired
  // convert snapshot still exists. Runtime entities created from
  // scratch (no convert origin) only see the Edit link.
  return (
    <>
      {row.restoreBackupId && (
        <RestoreConvertButton entityName={row.id} backupId={row.restoreBackupId} action={restoreAction} />
      )}
      <Link href={`/builder?entity=${encodeURIComponent(row.id)}`} className="text-xs text-primary hover:underline">
        Edit
      </Link>
    </>
  )
}

function EmptyState(): React.ReactNode {
  return (
    <div className="px-4 py-12 text-center text-sm text-muted-foreground">
      <p>No entities registered yet.</p>
      <p className="text-xs mt-1">
        Use <strong>Create new</strong> to build the first one.
      </p>
    </div>
  )
}
