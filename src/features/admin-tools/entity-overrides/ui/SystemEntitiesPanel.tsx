"use client"

/**
 * Lists every entity registered in the runtime registry (51 system
 * entities) alongside whether an admin override is currently applied.
 * The Edit action opens the override editor sheet; Reset wipes the
 * override and falls back to the source config.
 *
 * Mounted on `/admin/entity-builder` underneath the legacy-drafts card.
 */

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useNotification } from "@/ui/application"
import { Loader2, Pencil, RotateCcw, BadgeCheck } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { Badge } from "@/ui/design-system/primitives/badge"
import { fetchEntityRegistry, resetEntityOverride, type EntityProjection } from "../client-api"
import { EntityOverrideEditor } from "./EntityOverrideEditor"

export function SystemEntitiesPanel(): React.ReactNode {
  const t = useTranslations("admin.entity_overrides")
  const notifications = useNotification()
  const [entities, setEntities] = useState<EntityProjection[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EntityProjection | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { entities: list } = await fetchEntityRegistry()
      setEntities(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registry")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleReset = async (entityName: string) => {
    if (!window.confirm(t("confirm_reset", { name: entityName }))) return
    setBusy(entityName)
    try {
      await resetEntityOverride(entityName)
      notifications.success("admin.entity_overrides.reset_done")
      await reload()
    } catch (err) {
      notifications.error(err)
    } finally {
      setBusy(null)
    }
  }

  const filtered = applyFilter(entities, filter)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("panel.title")}</CardTitle>
          <CardDescription>{t("panel.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="search"
            placeholder={t("panel.search_placeholder")}
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-9 px-3 rounded-md border bg-background text-sm w-full max-w-xs"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <PanelBody loading={loading} entities={filtered} busy={busy} onEdit={setEditing} onReset={handleReset} />
        </CardContent>
      </Card>

      <EntityOverrideEditor
        entity={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </>
  )
}

function applyFilter(entities: EntityProjection[], filter: string): EntityProjection[] {
  if (!filter) return entities
  const q = filter.toLowerCase()
  return entities.filter(
    e =>
      e.entityName.toLowerCase().includes(q) ||
      e.singularName.toLowerCase().includes(q) ||
      e.pluralName.toLowerCase().includes(q),
  )
}

interface PanelBodyProps {
  loading: boolean
  entities: EntityProjection[]
  busy: string | null
  onEdit: (entity: EntityProjection) => void
  onReset: (entityName: string) => void
}

function PanelBody({ loading, entities, busy, onEdit, onReset }: PanelBodyProps) {
  const t = useTranslations("admin.entity_overrides.panel")
  if (loading) {
    return (
      <div className="py-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (entities.length === 0) return <p className="text-sm text-muted-foreground py-4">{t("empty")}</p>
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-start p-2 font-medium">{t("col_entity")}</th>
            <th className="text-start p-2 font-medium">{t("col_singular")}</th>
            <th className="text-start p-2 font-medium">{t("col_plural")}</th>
            <th className="text-start p-2 font-medium">{t("col_page_size")}</th>
            <th className="text-start p-2 font-medium">{t("col_base_path")}</th>
            <th className="text-start p-2 font-medium">{t("col_status")}</th>
            <th className="text-end p-2 font-medium">{t("col_actions")}</th>
          </tr>
        </thead>
        <tbody>
          {entities.map(e => (
            <EntityRow key={e.entityName} entity={e} busy={busy === e.entityName} onEdit={onEdit} onReset={onReset} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface EntityRowProps {
  entity: EntityProjection
  busy: boolean
  onEdit: (entity: EntityProjection) => void
  onReset: (entityName: string) => void
}

function EntityRow({ entity, busy, onEdit, onReset }: EntityRowProps) {
  const t = useTranslations("admin.entity_overrides.panel")
  return (
    <tr className="border-t border-border">
      <td className="p-2 font-mono text-xs">{entity.entityName}</td>
      <td className="p-2 text-xs">{entity.singularName}</td>
      <td className="p-2 text-xs">{entity.pluralName}</td>
      <td className="p-2 text-xs text-muted-foreground">{entity.defaultPageSize ?? "—"}</td>
      <td className="p-2 font-mono text-xs text-muted-foreground">{entity.basePath ?? "—"}</td>
      <td className="p-2">
        {entity.hasOverride ? (
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3 w-3" />
            {t("overridden")}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{t("source")}</span>
        )}
      </td>
      <td className="p-2">
        <div className="flex items-center justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(entity)} title={t("edit_btn")}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {entity.hasOverride && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onReset(entity.entityName)}
              disabled={busy}
              title={t("reset_btn")}
              className="text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
