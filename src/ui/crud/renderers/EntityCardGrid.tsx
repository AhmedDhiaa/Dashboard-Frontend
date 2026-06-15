"use client"

/**
 * Generic entity card grid — the card-view counterpart of the CRUD data table.
 *
 * Renders any entity's list rows as a responsive card grid, driven entirely by
 * the SAME `listColumns` metadata the table uses, with the SAME `FieldRenderer`
 * for value display. No per-entity code: toggle table ↔ cards on any
 * config-driven list and this picks a title column + a few body fields + the
 * standard view/edit/delete row actions.
 */

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { Card } from "@/ui/design-system/primitives/card"
import { Button } from "@/ui/design-system/primitives/button"
import { FieldRenderer } from "./field-renderers"
import type { ColumnMetadata } from "./table-column-factory"
import { useT } from "@/shared/config"
import { useConfirmDialog, useNotification } from "@/ui/application"
import { cn } from "@/shared/utils"

type Row = Record<string, unknown> & { id: string | number }

export interface EntityCardGridProps {
  /** The entity's list-column metadata (same array the table renders). */
  columns: ColumnMetadata[]
  /** The rows to render. */
  data: Array<Record<string, unknown>>
  /** Base path for row navigation (e.g. `/brands`). */
  basePath: string
  /** Effective permissions for the entity. */
  perms: { canView: boolean; canUpdate: boolean; canDelete: boolean }
  /** Entity feature flags (view/edit/delete enabled). */
  features?: { view?: boolean; edit?: boolean; delete?: boolean }
  /** Service used by the inline delete action. */
  service?: { delete: (id: string) => Promise<void> }
  /** Invalidate/refresh the list after a mutation. */
  onRefresh?: () => void
}

/** Resolve a (possibly dotted) field path off a row without throwing on gaps. */
function resolvePath(row: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) return row[path]
  let cursor: unknown = row
  for (const seg of path.split(".")) {
    if (cursor == null) return undefined
    cursor = (cursor as Record<string, unknown>)[seg]
  }
  return cursor
}

const isDisplayColumn = (c: ColumnMetadata): boolean =>
  c.id !== "actions" && c.type !== "button" && c.type !== "action-button" && !c.action

export function EntityCardGrid({ columns, data, basePath, perms, features, service, onRefresh }: EntityCardGridProps) {
  const t = useT()
  const router = useRouter()
  const { showConfirm } = useConfirmDialog()
  const notifications = useNotification()

  const { titleCol, bodyCols } = useMemo(() => {
    const display = columns.filter(isDisplayColumn)
    const title = display.find(c => c.type === "text-primary") ?? display[0]
    const body = display.filter(c => c !== title).slice(0, 6)
    return { titleCol: title, bodyCols: body }
  }, [columns])

  const label = (c: ColumnMetadata): string =>
    c.titleKey ? t(c.titleKey) : (c.label ?? t(`pages.${String(c.field).replace(/\./g, "_")}`))

  const hasView = features?.view !== false && perms.canView
  const hasEdit = features?.edit !== false && perms.canUpdate
  const hasDelete = features?.delete !== false && perms.canDelete && !!service

  const handleDelete = (row: Row) =>
    showConfirm(
      async () => {
        try {
          await service!.delete(String(row.id))
          notifications.success("crud.messages.success_delete")
          onRefresh?.()
        } catch (error) {
          notifications.error(error)
        }
      },
      {
        title: t("common.deleteConfirmation"),
        description: t("crud.messages.confirm_delete_message"),
        confirmText: t("common.delete"),
        variant: "destructive",
      },
    )

  return (
    <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {(data as Row[]).map(row => (
        <Card key={String(row.id)} className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md">
          <div className="truncate text-sm font-semibold text-foreground">
            {titleCol ? (
              <FieldRenderer value={resolvePath(row, String(titleCol.field)) as never} type={titleCol.type} entity={row as never} />
            ) : (
              `#${String(row.id)}`
            )}
          </div>

          {bodyCols.length > 0 && (
            <dl className="flex-1 space-y-1.5 text-sm">
              {bodyCols.map(c => (
                <div key={c.id ?? String(c.field)} className="flex items-center justify-between gap-2">
                  <dt className="shrink-0 text-xs text-muted-foreground">{label(c)}</dt>
                  <dd className={cn("min-w-0 truncate text-end", c.className)}>
                    <FieldRenderer
                      value={resolvePath(row, String(c.field)) as never}
                      type={c.type}
                      entity={row as never}
                      config={c.config ? { ...c.config, customRender: undefined } : undefined}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {(hasView || hasEdit || hasDelete) && (
            <div className="flex items-center justify-end gap-1 border-t border-border/50 pt-2">
              {hasView && (
                <Button size="icon" variant="ghost" onClick={() => router.push(`${basePath}/${row.id}`)} aria-label={t("common.view")}>
                  <Eye className="h-4 w-4 text-accent" />
                </Button>
              )}
              {hasEdit && (
                <Button size="icon" variant="ghost" onClick={() => router.push(`${basePath}/${row.id}/edit`)} aria-label={t("common.edit")}>
                  <Pencil className="h-4 w-4 text-secondary" />
                </Button>
              )}
              {hasDelete && (
                <Button size="icon" variant="ghost" onClick={() => handleDelete(row)} aria-label={t("common.delete")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
