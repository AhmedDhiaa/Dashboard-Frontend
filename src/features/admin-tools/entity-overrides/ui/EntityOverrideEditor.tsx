"use client"

/**
 * Side-sheet editor for one entity's override. Fields map 1:1 to the
 * allow-list in `schema.ts`; deletes the field from the override when
 * the user empties it back to the source default, so the override file
 * stays minimal.
 */

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { useNotification } from "@/ui/application"
import { Loader2, Save, RotateCcw, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/ui/design-system/primitives/button"
import { Input } from "@/ui/design-system/primitives/input"
import { Label } from "@/ui/design-system/primitives/label"
import { Switch } from "@/ui/design-system/primitives/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/ui/design-system/primitives/sheet"
import {
  fetchEntityOverride,
  resetEntityOverride,
  saveEntityOverride,
  type EntityProjection,
  type FormFieldProjection,
} from "../client-api"
import type { EntityOverride, FormFieldOverride } from "@/core/entities/overrides/schema"
import { entityOverrideSchema } from "@/core/entities/overrides/schema"

interface Props {
  entity: EntityProjection | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

const FEATURE_KEYS = ["create", "edit", "delete", "view", "export", "import", "bulkDelete"] as const

type FeatureKey = (typeof FEATURE_KEYS)[number]

interface FormState {
  singularName: string
  pluralName: string
  defaultPageSize: string
  defaultSortField: string
  defaultSortDirection: "asc" | "desc" | ""
  permissionKey: string
  basePath: string
  features: Record<FeatureKey, boolean | undefined>
  formFieldOrder: string[]
  formFields: Record<string, FormFieldOverride>
}

function initialFeatures(
  projection: EntityProjection,
  override: EntityOverride | null,
): Record<FeatureKey, boolean | undefined> {
  const out = {} as Record<FeatureKey, boolean | undefined>
  for (const key of FEATURE_KEYS) {
    out[key] = override?.features?.[key] ?? projection.features?.[key]
  }
  return out
}

function pickOrSource<T>(override: T | undefined, source: T | undefined, fallback: T): T {
  if (override !== undefined) return override
  if (source !== undefined) return source
  return fallback
}

function pickInitialSort(
  override: EntityOverride | null,
  projection: EntityProjection,
): { field: string; direction: "asc" | "desc" | "" } {
  return {
    field: pickOrSource(override?.defaultSort?.field, projection.defaultSort?.field, ""),
    direction: pickOrSource<"asc" | "desc" | "">(
      override?.defaultSort?.direction,
      projection.defaultSort?.direction,
      "",
    ),
  }
}

function projectionToInitialState(projection: EntityProjection, override: EntityOverride | null): FormState {
  const sort = pickInitialSort(override, projection)
  const pageSize = pickOrSource(override?.defaultPageSize, projection.defaultPageSize, undefined)
  return {
    singularName: pickOrSource(override?.singularName, projection.singularName, ""),
    pluralName: pickOrSource(override?.pluralName, projection.pluralName, ""),
    defaultPageSize: pageSize === undefined ? "" : String(pageSize),
    defaultSortField: sort.field,
    defaultSortDirection: sort.direction,
    permissionKey: pickOrSource(override?.permissionKey, projection.permissionKey, ""),
    basePath: pickOrSource(override?.basePath, projection.basePath, ""),
    features: initialFeatures(projection, override),
    formFieldOrder: override?.formFieldOrder ?? projection.formFieldOrder,
    formFields: { ...(override?.formFields ?? {}) },
  }
}

/** Emit the order array only when it differs from the source order. */
function diffFieldOrder(order: string[], source: string[]): string[] | undefined {
  if (order.length === source.length && order.every((name, i) => name === source[i])) return undefined
  return order
}

function diffString(value: string, source: string | undefined): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed === source) return undefined
  return trimmed
}

function diffPageSize(raw: string, source: number | undefined): number | undefined {
  if (!raw) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n === source ? undefined : n
}

function diffSort(
  field: string,
  direction: "asc" | "desc" | "",
  source: { field?: string; direction?: "asc" | "desc" } | undefined,
): { field: string; direction: "asc" | "desc" } | undefined {
  if (!field || !direction) return undefined
  if (field === source?.field && direction === source?.direction) return undefined
  return { field, direction }
}

function buildScalarOverrides(state: FormState, projection: EntityProjection): EntityOverride {
  const out: EntityOverride = {}
  const singular = diffString(state.singularName, projection.singularName)
  if (singular) out.singularName = singular
  const plural = diffString(state.pluralName, projection.pluralName)
  if (plural) out.pluralName = plural
  const pageSize = diffPageSize(state.defaultPageSize, projection.defaultPageSize)
  if (pageSize !== undefined) out.defaultPageSize = pageSize
  const sort = diffSort(state.defaultSortField, state.defaultSortDirection, projection.defaultSort)
  if (sort) out.defaultSort = sort
  const permissionKey = diffString(state.permissionKey, projection.permissionKey)
  if (permissionKey) out.permissionKey = permissionKey
  const basePath = diffString(state.basePath, projection.basePath)
  if (basePath) out.basePath = basePath
  return out
}

function buildFeaturesOverride(state: FormState, projection: EntityProjection): Record<string, boolean> | undefined {
  const features: Record<string, boolean> = {}
  for (const key of FEATURE_KEYS) {
    const value = state.features[key]
    const source = projection.features?.[key]
    if (typeof value === "boolean" && value !== source) features[key] = value
  }
  return Object.keys(features).length > 0 ? features : undefined
}

function cleanFieldOverride(patch: FormFieldOverride): FormFieldOverride {
  const cleaned: FormFieldOverride = {}
  if (patch.label !== undefined && patch.label !== "") cleaned.label = patch.label
  if (patch.placeholder !== undefined && patch.placeholder !== "") cleaned.placeholder = patch.placeholder
  if (patch.description !== undefined && patch.description !== "") cleaned.description = patch.description
  if (patch.required !== undefined) cleaned.required = patch.required
  if (patch.disabled !== undefined) cleaned.disabled = patch.disabled
  if (patch.hidden !== undefined) cleaned.hidden = patch.hidden
  if (patch.colSpan !== undefined) cleaned.colSpan = patch.colSpan
  if (patch.rows !== undefined) cleaned.rows = patch.rows
  return cleaned
}

function buildFormFieldsOverride(state: FormState): Record<string, FormFieldOverride> | undefined {
  const fields: Record<string, FormFieldOverride> = {}
  for (const [name, patch] of Object.entries(state.formFields)) {
    const cleaned = cleanFieldOverride(patch)
    if (Object.keys(cleaned).length > 0) fields[name] = cleaned
  }
  return Object.keys(fields).length > 0 ? fields : undefined
}

function buildOverridePayload(state: FormState, projection: EntityProjection): EntityOverride {
  const out: EntityOverride = buildScalarOverrides(state, projection)
  const features = buildFeaturesOverride(state, projection)
  if (features) out.features = features
  const order = diffFieldOrder(state.formFieldOrder, projection.formFieldOrder)
  if (order) out.formFieldOrder = order
  const formFields = buildFormFieldsOverride(state)
  if (formFields) out.formFields = formFields
  return out
}

function useLoadOverride(entity: EntityProjection | null, open: boolean) {
  const notifications = useNotification()
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState<FormState | null>(null)

  useEffect(() => {
    if (!entity || !open) return
    let cancelled = false
    setLoading(true)
    setState(null)
    fetchEntityOverride(entity.entityName)
      .then(existing => {
        if (!cancelled) setState(projectionToInitialState(entity, existing))
      })
      .catch(err => {
        if (!cancelled) notifications.error(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entity, open, notifications])

  return { loading, state, setState }
}

export function EntityOverrideEditor({ entity, open, onClose, onSaved }: Props): React.ReactNode {
  const t = useTranslations("admin.entity_overrides")
  const notifications = useNotification()
  const { loading: loadingExisting, state, setState } = useLoadOverride(entity, open)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  const dirty = useMemo(
    () => (entity && state ? Object.keys(buildOverridePayload(state, entity)).length > 0 : false),
    [entity, state],
  )

  if (!entity) return null

  const updateField = (name: string, patch: Partial<FormFieldOverride>) => {
    setState(prev => {
      if (!prev) return prev
      const existing = prev.formFields[name] ?? {}
      return { ...prev, formFields: { ...prev.formFields, [name]: { ...existing, ...patch } } }
    })
  }

  const moveField = (name: string, dir: -1 | 1) => {
    setState(prev => {
      if (!prev) return prev
      const order = [...prev.formFieldOrder]
      const i = order.indexOf(name)
      const j = i + dir
      if (i < 0 || j < 0 || j >= order.length) return prev
      ;[order[i], order[j]] = [order[j]!, order[i]!]
      return { ...prev, formFieldOrder: order }
    })
  }

  const handleSave = () => runSave({ entity, state, notifications, setSaving, onSaved, onClose })
  const handleReset = () => runReset({ entity, notifications, setResetting, onSaved, onClose })

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t("editor.title", { name: entity.singularName })}</SheetTitle>
          <SheetDescription>{t("editor.description")}</SheetDescription>
        </SheetHeader>
        {loadingExisting || !state ? (
          <LoadingBlock />
        ) : (
          <EditorBody
            entity={entity}
            state={state}
            setState={setState}
            updateField={updateField}
            moveField={moveField}
          />
        )}
        <EditorFooter
          hasOverride={entity.hasOverride}
          dirty={dirty}
          saving={saving}
          resetting={resetting}
          onSave={handleSave}
          onReset={handleReset}
        />
      </SheetContent>
    </Sheet>
  )
}

interface SaveCtx {
  entity: EntityProjection
  state: FormState | null
  notifications: ReturnType<typeof useNotification>
  setSaving: (v: boolean) => void
  onSaved: () => void
  onClose: () => void
}

async function runSave({ entity, state, notifications, setSaving, onSaved, onClose }: SaveCtx): Promise<void> {
  if (!state) return
  const payload = buildOverridePayload(state, entity)
  const validation = entityOverrideSchema.safeParse(payload)
  if (!validation.success) {
    notifications.error("admin.entity_overrides.invalid")
    return
  }
  setSaving(true)
  try {
    if (Object.keys(payload).length === 0) {
      await resetEntityOverride(entity.entityName)
      notifications.success("admin.entity_overrides.reset_done")
    } else {
      await saveEntityOverride(entity.entityName, validation.data)
      notifications.success("admin.entity_overrides.save_done")
    }
    onSaved()
    onClose()
  } catch (err) {
    notifications.error(err)
  } finally {
    setSaving(false)
  }
}

interface ResetCtx {
  entity: EntityProjection
  notifications: ReturnType<typeof useNotification>
  setResetting: (v: boolean) => void
  onSaved: () => void
  onClose: () => void
}

async function runReset({ entity, notifications, setResetting, onSaved, onClose }: ResetCtx): Promise<void> {
  setResetting(true)
  try {
    await resetEntityOverride(entity.entityName)
    notifications.success("admin.entity_overrides.reset_done")
    onSaved()
    onClose()
  } catch (err) {
    notifications.error(err)
  } finally {
    setResetting(false)
  }
}

interface EditorFooterProps {
  hasOverride: boolean
  dirty: boolean
  saving: boolean
  resetting: boolean
  onSave: () => void
  onReset: () => void
}

function EditorFooter({ hasOverride, dirty, saving, resetting, onSave, onReset }: EditorFooterProps) {
  const t = useTranslations("admin.entity_overrides.editor")
  return (
    <SheetFooter className="gap-2 sm:gap-2 mt-6">
      {hasOverride && (
        <Button variant="outline" onClick={onReset} disabled={saving || resetting} className="gap-2">
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {t("reset_btn")}
        </Button>
      )}
      <Button onClick={onSave} disabled={saving || resetting || !dirty} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t("save_btn")}
      </Button>
    </SheetFooter>
  )
}

function LoadingBlock() {
  return (
    <div className="py-12 flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}

interface EditorBodyProps {
  entity: EntityProjection
  state: FormState
  setState: React.Dispatch<React.SetStateAction<FormState | null>>
  updateField: (name: string, patch: Partial<FormFieldOverride>) => void
  moveField: (name: string, dir: -1 | 1) => void
}

function EditorBody({ entity, state, setState, updateField, moveField }: EditorBodyProps): React.ReactNode {
  const t = useTranslations("admin.entity_overrides")
  return (
    <div className="space-y-6 py-4">
      <Section title={t("editor.section_display")}>
        <Field label={t("editor.singular")}>
          <Input value={state.singularName} onChange={e => setState({ ...state, singularName: e.target.value })} />
        </Field>
        <Field label={t("editor.plural")}>
          <Input value={state.pluralName} onChange={e => setState({ ...state, pluralName: e.target.value })} />
        </Field>
      </Section>

      <Section title={t("editor.section_list")}>
        <Field label={t("editor.page_size")}>
          <Input
            type="number"
            min={1}
            max={500}
            value={state.defaultPageSize}
            onChange={e => setState({ ...state, defaultPageSize: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("editor.sort_field")}>
            <Input
              value={state.defaultSortField}
              onChange={e => setState({ ...state, defaultSortField: e.target.value })}
            />
          </Field>
          <Field label={t("editor.sort_direction")}>
            <select
              className="h-9 px-2 rounded-md border bg-background text-sm w-full"
              value={state.defaultSortDirection}
              onChange={e => setState({ ...state, defaultSortDirection: e.target.value as "asc" | "desc" | "" })}
            >
              <option value="">—</option>
              <option value="asc">{t("editor.asc")}</option>
              <option value="desc">{t("editor.desc")}</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title={t("editor.section_features")}>
        <FeaturesGrid state={state} setState={setState} />
      </Section>

      <Section title={t("editor.section_routing")}>
        <Field label={t("editor.permission_key")}>
          <Input value={state.permissionKey} onChange={e => setState({ ...state, permissionKey: e.target.value })} />
        </Field>
        <Field label={t("editor.base_path")}>
          <Input value={state.basePath} onChange={e => setState({ ...state, basePath: e.target.value })} />
        </Field>
      </Section>

      <Section title={t("editor.section_form_fields")}>
        <FormFieldsList fields={entity.formFields} state={state} onChange={updateField} onMove={moveField} />
      </Section>
    </div>
  )
}

function FeaturesGrid({
  state,
  setState,
}: {
  state: FormState
  setState: React.Dispatch<React.SetStateAction<FormState | null>>
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FEATURE_KEYS.map(key => (
        <div key={key} className="flex items-center justify-between rounded-md border p-2">
          <Label className="text-sm capitalize">{key}</Label>
          <Switch
            checked={state.features[key] ?? false}
            onCheckedChange={v => setState(prev => prev && { ...prev, features: { ...prev.features, [key]: v } })}
          />
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

interface FieldsListProps {
  fields: FormFieldProjection[]
  state: FormState
  onChange: (name: string, patch: Partial<FormFieldOverride>) => void
  onMove: (name: string, dir: -1 | 1) => void
}

function FormFieldsList({ fields, state, onChange, onMove }: FieldsListProps) {
  const t = useTranslations("admin.entity_overrides.editor")
  if (fields.length === 0) return <p className="text-xs text-muted-foreground">{t("no_fields")}</p>

  // Render in the (override-able) form order; drag-free reordering via the
  // up/down buttons rewrites `state.formFieldOrder`.
  const byName = new Map(fields.map(f => [f.name, f]))
  const ordered = state.formFieldOrder
    .map(name => byName.get(name))
    .filter((f): f is FormFieldProjection => f !== undefined)

  return (
    <ul className="space-y-2" data-testid="override-field-list">
      {ordered.map((f, idx) => (
        <FormFieldRow
          key={f.name}
          field={f}
          index={idx}
          total={ordered.length}
          state={state}
          onChange={onChange}
          onMove={onMove}
        />
      ))}
    </ul>
  )
}

interface FieldRowProps {
  field: FormFieldProjection
  index: number
  total: number
  state: FormState
  onChange: (name: string, patch: Partial<FormFieldOverride>) => void
  onMove: (name: string, dir: -1 | 1) => void
}

function FormFieldRow({ field, index, total, state, onChange, onMove }: FieldRowProps) {
  const t = useTranslations("admin.entity_overrides.editor")
  const ov = state.formFields[field.name] ?? {}
  const label = ov.label ?? field.label ?? ""
  const required = ov.required ?? field.required ?? false
  const disabled = ov.disabled ?? field.disabled ?? false
  const hidden = ov.hidden ?? field.hidden ?? false
  return (
    <li className="rounded-md border p-2 space-y-2" data-field={field.name}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === 0}
            onClick={() => onMove(field.name, -1)}
            aria-label={t("move_up")}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            disabled={index === total - 1}
            onClick={() => onMove(field.name, 1)}
            aria-label={t("move_down")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <span className="w-32 shrink-0 truncate font-mono text-xs" title={field.name}>
          {field.name}
        </span>
        <Input
          className="h-7 text-xs"
          value={label}
          placeholder={t("col_label")}
          onChange={e => onChange(field.name, { label: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-4 ps-8 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <Switch checked={required} onCheckedChange={v => onChange(field.name, { required: v })} />
          {t("col_required")}
        </label>
        <label className="flex items-center gap-1.5">
          <Switch checked={disabled} onCheckedChange={v => onChange(field.name, { disabled: v })} />
          {t("col_disabled")}
        </label>
        <label className="flex items-center gap-1.5">
          <Switch checked={hidden} onCheckedChange={v => onChange(field.name, { hidden: v })} />
          {t("col_hidden")}
        </label>
      </div>
    </li>
  )
}
