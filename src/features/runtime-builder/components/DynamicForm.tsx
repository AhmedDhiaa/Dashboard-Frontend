"use client"

/**
 * DynamicForm — renders a form from a RuntimeField[] schema.
 *
 * Self-contained on purpose: no react-hook-form, no zod. Keeping it small
 * means a generated entity form is ~2 KB of JS instead of pulling in the
 * existing form stack which is tuned for the API-backed CRUD engine.
 */

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import type { RuntimeField, RuntimeFieldType } from "../types"
import { useRuntimeConfig, useRuntimeProvider } from "../store/provider-context"
import { Input } from "@/ui/design-system/primitives/input"
import { Textarea } from "@/ui/design-system/primitives/textarea"
import { Switch } from "@/ui/design-system/primitives/switch"
import { Button } from "@/ui/design-system/primitives/button"
import { Label } from "@/ui/design-system/primitives/label"
import { Badge } from "@/ui/design-system/primitives/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"

export interface DynamicFormProps {
  fields: RuntimeField[]
  initialValues?: Record<string, unknown>
  submitLabel?: string
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>
  onCancel?: () => void
}

function computeDefaults(fields: RuntimeField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  fields.forEach(f => {
    if (f.defaultValue !== undefined) {
      out[f.key] = f.defaultValue
      return
    }
    switch (f.type) {
      case "boolean":
        out[f.key] = false
        break
      case "multi-select":
      case "tags":
        out[f.key] = []
        break
      case "number":
      case "currency":
      case "percentage":
        out[f.key] = ""
        break
      default:
        out[f.key] = ""
    }
  })
  return out
}

function validateNumber(field: RuntimeField, value: unknown): string | null {
  if (value === "" || value == null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return `${field.label} must be a number`
  const v = field.validation
  if (!v) return null
  if (v.min != null && n < v.min) return `${field.label} must be ≥ ${v.min}`
  if (v.max != null && n > v.max) return `${field.label} must be ≤ ${v.max}`
  return null
}

function validateText(field: RuntimeField, value: unknown): string | null {
  if (typeof value !== "string") return null
  const v = field.validation
  if (!v) return null
  if (v.minLength != null && value.length < v.minLength)
    return `${field.label} must be at least ${v.minLength} characters`
  if (v.maxLength != null && value.length > v.maxLength)
    return `${field.label} must be at most ${v.maxLength} characters`
  if (v.pattern) {
    try {
      if (!new RegExp(v.pattern).test(value)) return `${field.label} format is invalid`
    } catch {
      // Bad regex in config — ignore rather than crash
    }
  }
  return null
}

function validateFile(field: RuntimeField, value: unknown): string | null {
  if (!(value instanceof File)) return null
  const cap = field.fileConfig?.maxSizeKB
  if (cap != null && value.size > cap * 1024) {
    return `${field.label} must be ≤ ${cap} KB`
  }
  return null
}

// Map from field type → which per-type validator to call. Keeps `validate`
// flat (one dispatch lookup) and below the complexity gate.
const VALIDATORS: Partial<Record<RuntimeFieldType, (f: RuntimeField, v: unknown) => string | null>> = {
  number: validateNumber,
  currency: validateNumber,
  percentage: validateNumber,
  text: validateText,
  textarea: validateText,
  richtext: validateText,
  email: validateText,
  phone: validateText,
  url: validateText,
  color: validateText,
  file: validateFile,
  image: validateFile,
}

function validate(field: RuntimeField, value: unknown): string | null {
  if (field.required) {
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)
    if (empty) return `${field.label} is required`
  }
  return VALIDATORS[field.type]?.(field, value) ?? null
}

export function DynamicForm({ fields, initialValues, submitLabel = "Save", onSubmit, onCancel }: DynamicFormProps) {
  const defaults = useMemo(() => computeDefaults(fields), [fields])
  const [values, setValues] = useState<Record<string, unknown>>({ ...defaults, ...initialValues })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Re-seed when the schema or initial values change (e.g. switching from
  // create → edit on the same mount).
  useEffect(() => {
    setValues({ ...defaults, ...initialValues })
    setErrors({})
  }, [defaults, initialValues])

  const setField = (key: string, val: unknown) => {
    setValues(prev => ({ ...prev, [key]: val }))
    // Clear the error as soon as the user touches the field — don't wait for resubmit
    if (errors[key]) {
      setErrors(prev => {
        const { [key]: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    fields.forEach(f => {
      const err = validate(f, values[f.key])
      if (err) nextErrors[f.key] = err
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    // Coerce numbers before handing values back to the caller — storing
    // `"42"` as a string would break aggregation widgets later. The same
    // applies to currency / percentage which are number-shaped on disk.
    const coerced: Record<string, unknown> = {}
    fields.forEach(f => {
      const v = values[f.key]
      const isNumeric = f.type === "number" || f.type === "currency" || f.type === "percentage"
      if (isNumeric && v !== "" && v != null) coerced[f.key] = Number(v)
      else coerced[f.key] = v
    })

    setSubmitting(true)
    try {
      await onSubmit(coerced)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(field => (
        <FieldRow
          key={field.key}
          field={field}
          value={values[field.key]}
          error={errors[field.key]}
          onChange={val => setField(field.key, val)}
        />
      ))}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}

interface FieldRowProps {
  field: RuntimeField
  value: unknown
  error: string | undefined
  onChange: (value: unknown) => void
}

function FieldRow({ field, value, error, onChange }: FieldRowProps) {
  const id = `runtime-field-${field.key}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive ms-1">*</span>}
      </Label>
      <FieldControl id={id} field={field} value={value} onChange={onChange} />
      {field.description && !error && <p className="text-xs text-muted-foreground">{field.description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── FieldControl dispatch ──────────────────────────────────────────────────
//
// The dispatch table maps each field type to a renderer function. Splitting
// it this way keeps `FieldControl` itself a one-liner (well under the
// cyclomatic-complexity gate) and makes "add a new field type" a one-line
// table edit rather than another `case` in a 100-line switch.

type ControlProps = { id: string; field: RuntimeField; value: unknown; onChange: (v: unknown) => void }
type ControlRenderer = (p: ControlProps) => React.ReactNode

/**
 * Render a plain `<Input>` with a specific `type` attribute. Kept as a
 * regular helper (not a factory returning anonymous components) so the
 * `react/display-name` lint rule doesn't trip on the returned closures.
 */
function renderNativeInput(htmlType: string, props: ControlProps, fallbackPlaceholder?: string): React.ReactNode {
  return (
    <Input
      id={props.id}
      type={htmlType}
      value={(props.value as string) ?? ""}
      placeholder={props.field.placeholder ?? fallbackPlaceholder}
      onChange={e => props.onChange(e.target.value)}
    />
  )
}

const renderTextarea: ControlRenderer = ({ id, field, value, onChange }) => (
  <Textarea
    id={id}
    value={(value as string) ?? ""}
    placeholder={field.placeholder}
    onChange={e => onChange(e.target.value)}
  />
)

const renderBoolean: ControlRenderer = ({ id, value, onChange }) => (
  <div className="flex items-center gap-2">
    <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
    <span className="text-sm text-muted-foreground">{value ? "Yes" : "No"}</span>
  </div>
)

const renderColor: ControlRenderer = ({ id, value, onChange }) => (
  <Input
    id={id}
    type="color"
    value={(value as string) || "#000000"}
    onChange={e => onChange(e.target.value)}
    className="h-9 w-20 p-1"
  />
)

const renderSelect: ControlRenderer = ({ id, field, value, onChange }) => (
  <Select value={(value as string) ?? ""} onValueChange={onChange}>
    <SelectTrigger id={id}>
      <SelectValue placeholder={field.placeholder ?? "Select..."} />
    </SelectTrigger>
    <SelectContent>
      {(field.options ?? []).map(opt => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

const renderNumber: ControlRenderer = p => <NumberControl {...p} />
const renderCurrency: ControlRenderer = p => <CurrencyControl {...p} />
const renderPercentage: ControlRenderer = p => <PercentageControl {...p} />
const renderFile: ControlRenderer = p => <FileControl id={p.id} field={p.field} onChange={p.onChange} />
const renderMultiSelect: ControlRenderer = p => <MultiSelectControl {...p} />
const renderEntityAutocomplete: ControlRenderer = p => <EntityAutocompleteControl {...p} />
const renderEnum: ControlRenderer = p => <EnumControl {...p} />
const renderApiAutocomplete: ControlRenderer = p => <ApiAutocompleteControl {...p} />
const renderTags: ControlRenderer = p => <TagsControl {...p} />
const renderDate: ControlRenderer = p => renderNativeInput("date", p)
const renderDateTime: ControlRenderer = p => renderNativeInput("datetime-local", p)
const renderTime: ControlRenderer = p => renderNativeInput("time", p)
const renderEmail: ControlRenderer = p => renderNativeInput("email", p)
const renderPhone: ControlRenderer = p => renderNativeInput("tel", p)
const renderUrl: ControlRenderer = p => renderNativeInput("url", p, "https://")
const renderTextInput: ControlRenderer = p => renderNativeInput("text", p)

/** One renderer per field type. Unmapped types fall through to the text input. */
const CONTROL_RENDERERS: Partial<Record<RuntimeFieldType, ControlRenderer>> = {
  textarea: renderTextarea,
  // Rich text falls back to a plain textarea today. A proper WYSIWYG
  // renderer is tracked as future work — see UNRENDERED_FIELD_TYPES.
  richtext: renderTextarea,
  number: renderNumber,
  currency: renderCurrency,
  percentage: renderPercentage,
  boolean: renderBoolean,
  date: renderDate,
  datetime: renderDateTime,
  time: renderTime,
  color: renderColor,
  email: renderEmail,
  phone: renderPhone,
  url: renderUrl,
  file: renderFile,
  image: renderFile,
  select: renderSelect,
  "multi-select": renderMultiSelect,
  "entity-autocomplete": renderEntityAutocomplete,
  enum: renderEnum,
  "api-autocomplete": renderApiAutocomplete,
  tags: renderTags,
}

function FieldControl(props: ControlProps) {
  const render = CONTROL_RENDERERS[props.field.type] ?? renderTextInput
  return render(props)
}

function NumberControl({ id, field, value, onChange }: SubcontrolProps) {
  return (
    <Input
      id={id}
      type="number"
      value={(value as string | number | undefined) ?? ""}
      placeholder={field.placeholder}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function CurrencyControl({ id, field, value, onChange }: SubcontrolProps) {
  const code = field.currencyConfig?.currencyCode ?? "USD"
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 start-2 flex items-center text-xs font-medium text-muted-foreground">
        {code}
      </span>
      <Input
        id={id}
        type="number"
        step="0.01"
        value={(value as string | number | undefined) ?? ""}
        placeholder={field.placeholder}
        onChange={e => onChange(e.target.value)}
        className="ps-12"
      />
    </div>
  )
}

function PercentageControl({ id, field, value, onChange }: SubcontrolProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        step="0.1"
        value={(value as string | number | undefined) ?? ""}
        placeholder={field.placeholder}
        onChange={e => onChange(e.target.value)}
        className="pe-7"
      />
      <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs text-muted-foreground">
        %
      </span>
    </div>
  )
}

function FileControl({ id, field, onChange }: { id: string; field: RuntimeField; onChange: (v: unknown) => void }) {
  const accept = field.fileConfig?.accept?.join(",") ?? (field.type === "image" ? "image/*" : undefined)
  return <Input id={id} type="file" accept={accept} onChange={e => onChange(e.target.files?.[0] ?? null)} />
}

function MultiSelectControl({ id, field, value, onChange }: SubcontrolProps) {
  const selected = Array.isArray(value) ? (value as string[]) : []
  const toggle = (optionValue: string) => {
    const next = selected.includes(optionValue) ? selected.filter(v => v !== optionValue) : [...selected, optionValue]
    onChange(next)
  }
  return (
    <div id={id} className="grid gap-2 grid-cols-2 sm:grid-cols-3">
      {(field.options ?? []).map(opt => (
        <label key={opt.value} className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="rounded border-border"
          />
          {opt.label || opt.value}
        </label>
      ))}
    </div>
  )
}

interface SubcontrolProps {
  id: string
  field: RuntimeField
  value: unknown
  onChange: (v: unknown) => void
}

function EntityAutocompleteControl({ id, field, value, onChange }: SubcontrolProps) {
  // Populate the dropdown from records of the target runtime entity. The
  // runtime data view is the one place we have live records to choose
  // from; if the materialize → real-API path is taken later, the
  // generated config wires up a proper autocomplete component.
  const config = useRuntimeConfig()
  const provider = useRuntimeProvider()
  const targetId = field.entityAutocompleteConfig?.targetEntityName
  const displayField = field.entityAutocompleteConfig?.displayField ?? "name"
  const targetEntity = useMemo(
    () => (targetId ? config.entities.find(e => e.id === targetId) : undefined),
    [config, targetId],
  )
  const records = useMemo(() => {
    if (!targetEntity) return []
    return provider.list(targetEntity.id).items
  }, [provider, targetEntity])

  if (!targetEntity) {
    return <p className="text-xs text-destructive">Target entity {targetId ? `"${targetId}"` : ""} not found.</p>
  }
  return (
    <Select value={(value as string) ?? ""} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={field.placeholder ?? `Select ${targetEntity.singularName}…`} />
      </SelectTrigger>
      <SelectContent>
        {records.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No {targetEntity.pluralName.toLowerCase()} yet.
          </div>
        ) : (
          records.map(r => (
            <SelectItem key={r.id} value={r.id}>
              {String(r[displayField] ?? r.id)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

// ─── Fetched-options controls (enum + api-autocomplete) ────────────────────
//
// Both renderers hit a URL on mount, parse a flat array of rows out of the
// response, and render a plain <Select> over the result. They share a tiny
// useFetchedOptions hook so the loading / error / abort plumbing isn't
// duplicated. Kept inline with the other renderers per the file's
// convention.

interface FetchedOption {
  value: string
  label: string
}

type FetchedOptionsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; options: FetchedOption[] }

function useFetchedOptions(
  endpoint: string | undefined,
  toOptions: (rows: unknown) => FetchedOption[],
): FetchedOptionsState {
  const [state, setState] = useState<FetchedOptionsState>({ status: "loading" })
  useEffect(() => {
    if (!endpoint) {
      setState({ status: "error", message: "endpoint not configured" })
      return
    }
    const ac = new AbortController()
    setState({ status: "loading" })
    void (async () => {
      try {
        const response = await fetch(endpoint, { credentials: "include", signal: ac.signal })
        if (!response.ok) {
          setState({ status: "error", message: `Request failed (${response.status})` })
          return
        }
        const body = (await response.json()) as unknown
        setState({ status: "ready", options: toOptions(body) })
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return
        setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load options" })
      }
    })()
    return () => ac.abort()
  }, [endpoint, toOptions])
  return state
}

function FetchedSelect({ id, field, value, onChange, state }: SubcontrolProps & { state: FetchedOptionsState }) {
  if (state.status === "error") {
    return <p className="text-xs text-destructive">Failed to load options: {state.message}</p>
  }
  const placeholder = state.status === "loading" ? "Loading…" : (field.placeholder ?? "Select…")
  const options = state.status === "ready" ? state.options : []
  return (
    <Select value={(value as string) ?? ""} onValueChange={onChange} disabled={state.status === "loading"}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 && state.status === "ready" ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No options available.</div>
        ) : (
          options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

function EnumControl({ id, field, value, onChange }: SubcontrolProps) {
  const cfg = field.enumConfig
  const valueField = cfg?.valueField ?? "id"
  const displayField = cfg?.displayField ?? "name"
  const endpoint = cfg?.enumType ? `/api/app/enum/${cfg.enumType}` : undefined
  const toOptions = useMemo(
    () =>
      (body: unknown): FetchedOption[] => {
        const rows = Array.isArray(body) ? body : []
        return rows
          .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
          .map(r => ({ value: String(r[valueField] ?? ""), label: String(r[displayField] ?? r[valueField] ?? "") }))
          .filter(o => o.value !== "")
      },
    [valueField, displayField],
  )
  const state = useFetchedOptions(endpoint, toOptions)
  if (!cfg?.enumType) {
    return <p className="text-xs text-destructive">Enum type not configured.</p>
  }
  return <FetchedSelect id={id} field={field} value={value} onChange={onChange} state={state} />
}

// TODO(category-c): Select handles small datasets (< ~100 items) well, but
// for endpoints returning thousands of rows (e.g. orders, customers,
// products) this should be replaced with a search-as-you-type Combobox.
// The runtime-builder's ~2 KB design budget (see file header at line 6-8)
// currently rules out cmdk/Popover; revisit when a real consumer hits
// this scale.
// Trigger: a configured api-autocomplete endpoint regularly returns > ~100
// results AND users report the Select UX as broken.
function ApiAutocompleteControl({ id, field, value, onChange }: SubcontrolProps) {
  const cfg = field.apiAutocompleteConfig
  const endpoint = cfg?.endpoint
  const valueField = cfg?.valueField
  const labelField = cfg?.labelField
  const toOptions = useMemo(
    () =>
      (body: unknown): FetchedOption[] => {
        // Accept either `{ items: T[] }` or a raw `T[]` — matches the
        // tolerance pattern used in DynamicPagesSection.
        const rows = Array.isArray(body)
          ? body
          : Array.isArray((body as { items?: unknown })?.items)
            ? (body as { items: unknown[] }).items
            : []
        return rows
          .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
          .map(r => ({
            value: String(r[valueField ?? "id"] ?? ""),
            label: String(r[labelField ?? "name"] ?? r[valueField ?? "id"] ?? ""),
          }))
          .filter(o => o.value !== "")
      },
    [valueField, labelField],
  )
  const state = useFetchedOptions(endpoint, toOptions)
  if (!endpoint || !valueField || !labelField) {
    return <p className="text-xs text-destructive">api-autocomplete config incomplete.</p>
  }
  return <FetchedSelect id={id} field={field} value={value} onChange={onChange} state={state} />
}

// ─── TagsControl ────────────────────────────────────────────────────────────
//
// Chip-style array editor composed from existing primitives — no new
// dependency. Enter or "Add" commits the draft; clicking a chip's X
// removes it. Dedup defaults to on (matches the rest of the codebase's
// multi-select behavior); maxCount caps the array length.

function TagsControl({ id, field, value, onChange }: SubcontrolProps) {
  const tags = Array.isArray(value) ? (value as string[]) : []
  const [draft, setDraft] = useState("")
  const cfg = field.tagsConfig
  const allowDuplicates = cfg?.allowDuplicates === true
  const atCap = cfg?.maxCount != null && tags.length >= cfg.maxCount

  const commit = () => {
    const next = draft.trim()
    if (!next) return
    if (!allowDuplicates && tags.includes(next)) {
      setDraft("")
      return
    }
    if (atCap) return
    onChange([...tags, next])
    setDraft("")
  }

  const remove = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          placeholder={field.placeholder ?? "Type and press Enter…"}
          disabled={atCap}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
          }}
        />
        <Button type="button" variant="outline" onClick={commit} disabled={atCap || draft.trim() === ""}>
          Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 pe-1">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${tag}`}
                className="rounded-sm p-0.5 hover:bg-muted/60"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
