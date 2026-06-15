"use client"

/**
 * /admin/page-builder — list every saved page. Each row exposes
 * View / Edit / Delete; the + New button opens the naming dialog and then
 * drops into the canvas editor. Mirror of the widget-builder dashboard so
 * the admin surface feels consistent.
 *
 * This replaced the old behaviour where the route rendered the canvas
 * directly with a hardcoded "draft-page" — which meant every save clobbered
 * the same draft and there was no way to open or edit a named page.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, ExternalLink, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { usePermissionContext } from "@/core/auth/context/PermissionContext"
import { PERMISSIONS } from "@/shared/auth/permission-keys"
import { listPages, deletePage, type PageSummary } from "./api"
import { NewPageDialog } from "./NewPageDialog"

const MANAGE_PERMISSION = PERMISSIONS.ADMIN_PAGE_BUILDER

export function PageBuilderDashboard(): React.ReactNode {
  const router = useRouter()
  const { isAdmin, isGranted, isLoading } = usePermissionContext()
  const canEdit = isAdmin || isGranted(MANAGE_PERMISSION)

  const [pages, setPages] = useState<PageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPages(await listPages())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list pages")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canEdit) void reload()
  }, [canEdit, reload])

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Delete page "${id}"? This removes its JSON and i18n keys.`)) return
    setBusy(id)
    try {
      await deletePage(id)
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
      <Header onNew={() => setDialogOpen(true)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading pages…</div>
      ) : pages.length === 0 ? (
        <EmptyState onNew={() => setDialogOpen(true)} />
      ) : (
        <PagesTable pages={pages} busy={busy} router={router} onDelete={handleDelete} />
      )}
      <NewPageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={id => router.push(`/admin/page-builder/edit/${id}`)}
      />
    </div>
  )
}

function ForbiddenNotice(): React.ReactNode {
  return (
    <div className="p-12 text-center">
      <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
      <p className="font-semibold">You don&apos;t have permission to use the page builder.</p>
      <p className="text-xs text-muted-foreground mt-1">Required: {MANAGE_PERMISSION} (or admin role)</p>
    </div>
  )
}

function Header({ onNew }: { onNew: () => void }): React.ReactNode {
  return (
    <header className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Page builder</h1>
          <p className="text-xs text-muted-foreground">
            Create, edit or delete drag-and-drop pages. New pages start through <strong>+ New page</strong>.
          </p>
        </div>
      </div>
      <Button onClick={onNew} className="gap-2">
        <Plus className="h-4 w-4" />
        New page
      </Button>
    </header>
  )
}

function EmptyState({ onNew }: { onNew: () => void }): React.ReactNode {
  return (
    <div className="border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
      <p>No pages yet.</p>
      <Button onClick={onNew} variant="outline" className="mt-3 gap-2">
        <Plus className="h-4 w-4" />
        Create your first page
      </Button>
    </div>
  )
}

interface PagesTableProps {
  pages: PageSummary[]
  busy: string | null
  router: ReturnType<typeof useRouter>
  onDelete: (id: string) => void
}

function PagesTable({ pages, busy, router, onDelete }: PagesTableProps): React.ReactNode {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-start p-2 font-medium">Title</th>
            <th className="text-start p-2 font-medium">Id</th>
            <th className="text-start p-2 font-medium">Layout</th>
            <th className="text-start p-2 font-medium">Blocks</th>
            <th className="text-end p-2 font-medium w-36">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pages.map(p => (
            <PageRow key={p.id} page={p} busy={busy === p.id} router={router} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface PageRowProps {
  page: PageSummary
  busy: boolean
  router: ReturnType<typeof useRouter>
  onDelete: (id: string) => void
}

function PageRow({ page, busy, router, onDelete }: PageRowProps): React.ReactNode {
  return (
    <tr className="border-t border-border">
      <td className="p-2">{page.title.en || page.id}</td>
      <td className="p-2 font-mono text-xs text-muted-foreground">{page.id}</td>
      <td className="p-2 text-xs">{page.layout}</td>
      <td className="p-2 text-xs tabular-nums">{page.blockCount}</td>
      <td className="p-2">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => window.open(`/pages/${page.id}`, "_blank", "noopener")}
            title="View live page"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => router.push(`/admin/page-builder/edit/${page.id}`)}
            disabled={busy}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(page.id)}
            disabled={busy}
            className="text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
