"use client"

/**
 * PageManager — manage sidebar pages: create, link to entities/dashboards,
 * reorder (up/down arrows for now — drag-and-drop is overkill for a few pages),
 * toggle enabled, delete.
 */

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import type { RuntimePage, RuntimePageType } from "../types"
import { createPage, deletePage, reorderPages, updatePage, useRuntimeConfig, useRuntimeProvider } from "../store"
import { Input } from "@/ui/design-system/primitives/input"
import { Button } from "@/ui/design-system/primitives/button"
import { Label } from "@/ui/design-system/primitives/label"
import { Switch } from "@/ui/design-system/primitives/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"

// eslint-disable-next-line max-lines-per-function -- Page-management screen, splitting hurts cohesion
export function PageManager() {
  const provider = useRuntimeProvider()
  const config = useRuntimeConfig()
  const [draftTitle, setDraftTitle] = useState("")
  const [draftType, setDraftType] = useState<RuntimePageType>("entity")
  const [draftEntityId, setDraftEntityId] = useState<string>("")
  const [draftDashboardId, setDraftDashboardId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const pages = [...config.pages].sort((a, b) => a.order - b.order)

  const handleCreate = () => {
    setError(null)
    if (!draftTitle.trim()) {
      setError("Page title is required.")
      return
    }
    if (draftType === "entity" && !draftEntityId) {
      setError("Select an entity for this page.")
      return
    }
    if (draftType === "dashboard" && !draftDashboardId) {
      setError("Select a dashboard for this page.")
      return
    }
    createPage(provider, {
      title: draftTitle.trim(),
      type: draftType,
      entityId: draftType === "entity" ? draftEntityId : undefined,
      dashboardId: draftType === "dashboard" ? draftDashboardId : undefined,
      enabled: true,
    })
    setDraftTitle("")
    setDraftEntityId("")
    setDraftDashboardId("")
  }

  const move = (id: string, dir: -1 | 1) => {
    const idx = pages.findIndex(p => p.id === id)
    const target = idx + dir
    if (idx === -1 || target < 0 || target >= pages.length) return
    const next = [...pages]
    const tmp = next[idx]
    const other = next[target]
    if (!tmp || !other) return
    next[idx] = other
    next[target] = tmp
    reorderPages(
      provider,
      next.map(p => p.id),
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pm-title">Title</Label>
              <Input
                id="pm-title"
                placeholder="e.g. All Customers"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pm-type">Type</Label>
              <Select value={draftType} onValueChange={v => setDraftType(v as RuntimePageType)}>
                <SelectTrigger id="pm-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entity">Entity (CRUD)</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draftType === "entity" && (
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="pm-entity">Entity</Label>
                <Select value={draftEntityId} onValueChange={setDraftEntityId}>
                  <SelectTrigger id="pm-entity">
                    <SelectValue
                      placeholder={
                        config.entities.length === 0 ? "No entities yet — create one first" : "Pick an entity"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {config.entities.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.pluralName} ({e.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {draftType === "dashboard" && (
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="pm-dash">Dashboard</Label>
                <Select value={draftDashboardId} onValueChange={setDraftDashboardId}>
                  <SelectTrigger id="pm-dash">
                    <SelectValue
                      placeholder={
                        config.dashboards.length === 0 ? "No dashboards yet — create one first" : "Pick a dashboard"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {config.dashboards.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add page
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No pages yet. Create one above to add an item to the runtime sidebar.
            </p>
          ) : (
            <div className="space-y-2">
              {pages.map((page, i) => (
                <PageRow
                  key={page.id}
                  page={page}
                  isFirst={i === 0}
                  isLast={i === pages.length - 1}
                  entityName={config.entities.find(e => e.id === page.entityId)?.pluralName}
                  dashboardName={config.dashboards.find(d => d.id === page.dashboardId)?.title}
                  onToggle={enabled => updatePage(provider, page.id, { enabled })}
                  onRename={title => updatePage(provider, page.id, { title })}
                  onMove={dir => move(page.id, dir)}
                  onDelete={() => deletePage(provider, page.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface PageRowProps {
  page: RuntimePage
  isFirst: boolean
  isLast: boolean
  entityName?: string
  dashboardName?: string
  onToggle: (enabled: boolean) => void
  onRename: (title: string) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}

function PageRow({
  page,
  isFirst,
  isLast,
  entityName,
  dashboardName,
  onToggle,
  onRename,
  onMove,
  onDelete,
}: PageRowProps) {
  const subtitle =
    page.type === "entity"
      ? entityName
        ? `Entity: ${entityName}`
        : "Entity (broken link)"
      : page.type === "dashboard"
        ? dashboardName
          ? `Dashboard: ${dashboardName}`
          : "Dashboard (broken link)"
        : "Custom"

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Move up"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Move down"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <Input
          value={page.title}
          onChange={e => onRename(e.target.value)}
          className="h-8 border-transparent bg-transparent hover:border-border focus-visible:border-input"
        />
        <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={page.enabled} onCheckedChange={onToggle} aria-label="Enabled" />
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete page">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
