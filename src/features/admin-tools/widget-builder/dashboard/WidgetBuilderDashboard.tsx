"use client"

/**
 * /admin/widget-builder — list every saved widget. Each row exposes
 * Edit / Delete; the +New button drops into the wizard. Mirror of the
 * entity-builder dashboard so the admin surface feels consistent.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LayoutGrid, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { listWidgets, deleteWidget, type WidgetSummary } from "./api"
import { PERMISSIONS } from "@/shared/auth/permission-keys"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_WIDGET_BUILDER

export function WidgetBuilderDashboard(): React.ReactNode {
  const router = useRouter()
  const { isAdmin, isGranted, isLoading } = usePermissionContext()
  const canEdit = isAdmin || isGranted(MANAGE_PERMISSION)

  const [widgets, setWidgets] = useState<WidgetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setWidgets(await listWidgets())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list widgets")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canEdit) void reload()
  }, [canEdit, reload])

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete widget "${id}"? This is destructive.`)) return
    setBusy(id)
    try {
      await deleteWidget(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
  if (!canEdit) return <ForbiddenNotice />

  return (
    <div className="p-6 space-y-4">
      <Header onNew={() => router.push("/admin/widget-builder/new")} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading widgets…</div>
      ) : widgets.length === 0 ? (
        <EmptyState />
      ) : (
        <Table widgets={widgets} busy={busy} router={router} onDelete={handleDelete} />
      )}
    </div>
  )
}

function ForbiddenNotice() {
  return (
    <div className="p-12 text-center">
      <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
      <p className="font-semibold">You don&apos;t have permission to use the widget builder.</p>
      <p className="text-xs text-muted-foreground mt-1">Required: {MANAGE_PERMISSION} (or admin role)</p>
    </div>
  )
}

function Header({ onNew }: { onNew: () => void }) {
  return (
    <header className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Widget builder</h1>
          <p className="text-xs text-muted-foreground">
            Edit or delete saved dashboard widgets. Brand-new widgets go through <strong>+ New</strong>.
          </p>
        </div>
      </div>
      <Button onClick={onNew} className="gap-2">
        <Plus className="h-4 w-4" />
        New widget
      </Button>
    </header>
  )
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
      No widgets yet. Click <strong>New widget</strong> to scaffold one.
    </div>
  )
}

interface TableProps {
  widgets: WidgetSummary[]
  busy: string | null
  router: ReturnType<typeof useRouter>
  onDelete: (id: string) => void
}

function Table({ widgets, busy, router, onDelete }: TableProps) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-start p-2 font-medium">Id</th>
            <th className="text-start p-2 font-medium">Category</th>
            <th className="text-start p-2 font-medium">Source</th>
            <th className="text-start p-2 font-medium">Permission</th>
            <th className="text-end p-2 font-medium w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {widgets.map(w => (
            <tr key={w.id} className="border-t border-border">
              <td className="p-2 font-mono text-xs">{w.id}</td>
              <td className="p-2 text-xs">{w.category}</td>
              <td className="p-2 font-mono text-xs text-muted-foreground">{w.source}</td>
              <td className="p-2 font-mono text-xs">{w.permissionKey}</td>
              <td className="p-2">
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => router.push(`/admin/widget-builder/edit/${w.id}`)}
                    disabled={busy === w.id}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(w.id)}
                    disabled={busy === w.id}
                    className="text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
