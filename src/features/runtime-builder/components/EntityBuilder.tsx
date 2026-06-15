"use client"

/**
 * EntityBuilder — UI for creating and editing a RuntimeEntity.
 *
 * Owns top-level form state, validation, and save dispatch. The fields
 * list and per-field editor live in `EntityFieldsList.tsx` and
 * `EntityFieldEditor.tsx`; the advanced flags / filters / bulk actions
 * panel is `EntityAdvancedPanel.tsx`. Each can grow without bloating the
 * orchestrator.
 *
 * Form is intentionally chunky (each field gets its own card with all
 * knobs visible) — the cognitive cost of "where is the required toggle?"
 * is worse than the vertical scroll.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { RuntimeEntity, RuntimeField } from "../types"
import { upsertEntity, useRuntimeProvider } from "../store"
import { Input } from "@/ui/design-system/primitives/input"
import { Textarea } from "@/ui/design-system/primitives/textarea"
import { Button } from "@/ui/design-system/primitives/button"
import { Label } from "@/ui/design-system/primitives/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/design-system/primitives/card"
import { useNotification } from "@/ui/application"
import { notifySourceWrite } from "@/features/admin-tools/git-bridge/dashboard/notify-source-write"
import { EntityAdvancedPanel } from "./EntityAdvancedPanel"
import { EntityFieldsList } from "./EntityFieldsList"

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function validateMetadata(entity: RuntimeEntity): string | null {
  if (!entity.pluralName.trim() || !entity.singularName.trim()) {
    return "Both singular and plural names are required."
  }
  if (!entity.id.trim()) return "Entity id is required."
  if (!/^[a-z][a-z0-9-]*$/.test(entity.id)) {
    return "Entity id must be lowercase letters, numbers, or hyphens (start with a letter)."
  }
  if (entity.fields.length === 0) return "Add at least one field."
  return null
}

function validateFields(fields: RuntimeField[]): string | null {
  const seen = new Set<string>()
  for (const f of fields) {
    if (!f.key || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.key)) {
      return `Field key "${f.key}" is invalid (must be a valid identifier).`
    }
    if (seen.has(f.key)) return `Duplicate field key: "${f.key}"`
    seen.add(f.key)
    if (!f.label.trim()) return `Field "${f.key}" needs a label.`
    if (f.type === "select" && (!f.options || f.options.length === 0)) {
      return `Select field "${f.label}" needs at least one option.`
    }
  }
  return null
}

function emptyEntity(): RuntimeEntity {
  return {
    id: "",
    pluralName: "",
    singularName: "",
    icon: "Database",
    description: "",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        isTitle: true,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export interface EntityBuilderProps {
  /** When provided, edit mode; otherwise create mode */
  initialEntity?: RuntimeEntity
  onSaved?: (entity: RuntimeEntity) => void
  onCancel?: () => void
}

// eslint-disable-next-line max-lines-per-function -- Cohesive builder screen with co-located metadata form, fields list dispatch, and save handler
export function EntityBuilder({ initialEntity, onSaved, onCancel }: EntityBuilderProps) {
  const provider = useRuntimeProvider()
  const router = useRouter()
  const notifications = useNotification()
  const isEdit = Boolean(initialEntity)
  const [entity, setEntity] = useState<RuntimeEntity>(() => initialEntity ?? emptyEntity())
  const [error, setError] = useState<string | null>(null)

  // If parent swaps the entity prop, re-seed local state. Without this, opening
  // the builder twice (different entities) would keep showing the first one.
  useEffect(() => {
    if (initialEntity) setEntity(initialEntity)
  }, [initialEntity])

  // Auto-derive id + singularName from pluralName while creating, but stop
  // touching them once the user customizes either (or if we're editing).
  const updatePlural = (value: string) => {
    setEntity(prev => {
      if (isEdit) return { ...prev, pluralName: value }
      const autoId = slugify(value)
      const autoSingular = value.endsWith("s") ? value.slice(0, -1) : value
      return {
        ...prev,
        pluralName: value,
        id: prev.id === "" || prev.id === slugify(prev.pluralName) ? autoId : prev.id,
        singularName:
          prev.singularName === "" ||
          prev.singularName === (prev.pluralName.endsWith("s") ? prev.pluralName.slice(0, -1) : prev.pluralName)
            ? autoSingular
            : prev.singularName,
      }
    })
  }

  const updateField = (idx: number, patch: Partial<RuntimeField>) => {
    setEntity(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }))
  }

  const addField = () => {
    setEntity(prev => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          key: `field_${prev.fields.length + 1}`,
          label: `Field ${prev.fields.length + 1}`,
          type: "text",
        },
      ],
    }))
  }

  const removeField = (idx: number) => {
    setEntity(prev => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }))
  }

  const moveField = (idx: number, dir: -1 | 1) => {
    setEntity(prev => {
      const next = [...prev.fields]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[idx]
      const other = next[target]
      if (!tmp || !other) return prev
      next[idx] = other
      next[target] = tmp
      return { ...prev, fields: next }
    })
  }

  const makeFieldTitle = (idx: number) => {
    setEntity(prev => ({
      ...prev,
      fields: prev.fields.map((other, i) => ({ ...other, isTitle: i === idx })),
    }))
  }

  const handleSave = () => {
    setError(null)
    const metaError = validateMetadata(entity)
    if (metaError) {
      setError(metaError)
      return
    }
    const fieldError = validateFields(entity.fields)
    if (fieldError) {
      setError(fieldError)
      return
    }
    // Block id collision on create (edit just overwrites)
    if (!isEdit) {
      const cfg = provider.loadConfig()
      if (cfg.entities.some(e => e.id === entity.id)) {
        setError(`An entity with id "${entity.id}" already exists.`)
        return
      }
    }

    // Ensure exactly one title field — fall back to the first one
    const hasTitle = entity.fields.some(f => f.isTitle)
    const finalFields = hasTitle ? entity.fields : entity.fields.map((f, i) => (i === 0 ? { ...f, isTitle: true } : f))

    const next: RuntimeEntity = {
      ...entity,
      fields: finalFields,
      updatedAt: Date.now(),
      createdAt: isEdit ? entity.createdAt : Date.now(),
    }
    upsertEntity(provider, next)
    notifySourceWrite(notifications, 1, router)
    onSaved?.(next)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Entity Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="re-plural">Plural name</Label>
            <Input
              id="re-plural"
              value={entity.pluralName}
              onChange={e => updatePlural(e.target.value)}
              placeholder="e.g. Customers"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-plural-ar">Plural name (AR)</Label>
            <Input
              id="re-plural-ar"
              value={entity.pluralNameAr ?? ""}
              onChange={e => setEntity(p => ({ ...p, pluralNameAr: e.target.value }))}
              placeholder="مثال: العملاء"
              dir="rtl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-singular">Singular name</Label>
            <Input
              id="re-singular"
              value={entity.singularName}
              onChange={e => setEntity(p => ({ ...p, singularName: e.target.value }))}
              placeholder="e.g. Customer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-singular-ar">Singular name (AR)</Label>
            <Input
              id="re-singular-ar"
              value={entity.singularNameAr ?? ""}
              onChange={e => setEntity(p => ({ ...p, singularNameAr: e.target.value }))}
              placeholder="مثال: عميل"
              dir="rtl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="re-id">Entity id</Label>
            <Input
              id="re-id"
              value={entity.id}
              disabled={isEdit}
              onChange={e => setEntity(p => ({ ...p, id: e.target.value }))}
              placeholder="customers"
            />
            <p className="text-xs text-muted-foreground">Used in URLs and storage. Cannot be changed after creation.</p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="re-desc">Description (optional)</Label>
            <Textarea
              id="re-desc"
              value={entity.description ?? ""}
              onChange={e => setEntity(p => ({ ...p, description: e.target.value }))}
              placeholder="What does this entity represent?"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="re-desc-ar">Description (AR, optional)</Label>
            <Textarea
              id="re-desc-ar"
              value={entity.descriptionAr ?? ""}
              onChange={e => setEntity(p => ({ ...p, descriptionAr: e.target.value }))}
              placeholder="ماذا يمثّل هذا الكيان؟"
              dir="rtl"
            />
          </div>
        </CardContent>
      </Card>

      <EntityFieldsList
        fields={entity.fields}
        onAdd={addField}
        onUpdate={updateField}
        onRemove={removeField}
        onMove={moveField}
        onMakeTitle={makeFieldTitle}
      />

      <EntityAdvancedPanel entity={entity} onChange={patch => setEntity(prev => ({ ...prev, ...patch }))} />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave}>{isEdit ? "Save changes" : "Create entity"}</Button>
      </div>
    </div>
  )
}
