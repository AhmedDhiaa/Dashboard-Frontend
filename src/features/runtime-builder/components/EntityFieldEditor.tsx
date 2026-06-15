"use client"

/**
 * EntityFieldEditor — per-field card inside the entity builder.
 *
 * Owns the controls for a single `RuntimeField`: label, key, type, required
 * toggle, placeholder, plus type-conditional sub-rows. Reads/writes through
 * `onChange` patches so the parent builder stays the single source of truth
 * for the entity.
 *
 * Sub-rows stay co-located here because they're only rendered by this card
 * and pulling them into a third file would just add indirection.
 */

import { Plus, Trash2, GripVertical } from "lucide-react"
import type {
  RuntimeApiAutocompleteConfig,
  RuntimeCurrencyConfig,
  RuntimeEntityAutocompleteConfig,
  RuntimeEnumConfig,
  RuntimeField,
  RuntimeFieldOption,
  RuntimeFieldType,
  RuntimeFileConfig,
  RuntimeTagsConfig,
} from "../types"
import type { EnumTypeName } from "@/core/enums/enum.types"
import { useRuntimeConfig } from "../store/provider-context"
import { Input } from "@/ui/design-system/primitives/input"
import { Switch } from "@/ui/design-system/primitives/switch"
import { Button } from "@/ui/design-system/primitives/button"
import { Label } from "@/ui/design-system/primitives/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/primitives/select"

/**
 * Order matches the in-UI dropdown. Grouped loosely from "common" at the
 * top to "specialised" at the bottom so the picker stays scannable.
 */
const FIELD_TYPES: { value: RuntimeFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long text" },
  { value: "richtext", label: "Rich text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "select", label: "Select" },
  { value: "multi-select", label: "Multi-select" },
  { value: "boolean", label: "Yes/No" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date + time" },
  { value: "time", label: "Time" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "color", label: "Color" },
  { value: "file", label: "File upload" },
  { value: "image", label: "Image upload" },
  { value: "entity-autocomplete", label: "Reference (other entity)" },
  { value: "enum", label: "Enum (registry-backed)" },
  { value: "api-autocomplete", label: "API autocomplete" },
  { value: "tags", label: "Tags (chip list)" },
]

/**
 * Enum-type names accepted by `/api/app/enum/${enumType}`. Kept as a local
 * const (rather than imported as a runtime value) so the EnumTypeName type
 * stays the single source of truth — if the type list grows, this array
 * fails the satisfies check and the new entry has to be added intentionally.
 */
const ENUM_TYPE_NAMES = [
  "entity-type",
  "user-one-time-password-type",
  "amount-type",
  "status",
  "notification-type",
  "notification-status",
  "settlement-method",
  "business-partner-type",
  "entity-change-type",
  "extra-charge-type",
  "ticket-status",
] as const satisfies readonly EnumTypeName[]

/** Currency codes offered in the inline picker — ISO 4217 subset. */
const COMMON_CURRENCY_CODES = ["USD", "EUR", "GBP", "IQD", "SAR", "AED", "JOD", "EGP"] as const

const TYPES_WITH_OPTIONS = new Set<RuntimeFieldType>(["select", "multi-select"])
const TYPES_WITH_VALIDATION = new Set<RuntimeFieldType>([
  "text",
  "textarea",
  "richtext",
  "number",
  "currency",
  "percentage",
])

export interface FieldEditorProps {
  index: number
  field: RuntimeField
  isFirst: boolean
  isLast: boolean
  canRemove: boolean
  onChange: (patch: Partial<RuntimeField>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onMakeTitle: () => void
}

export function EntityFieldEditor(props: FieldEditorProps) {
  const { index, field, onChange } = props
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <FieldHeaderRow {...props} />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`f-${index}-label`}>Label</Label>
          <Input id={`f-${index}-label`} value={field.label} onChange={e => onChange({ label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`f-${index}-label-ar`}>Label (AR)</Label>
          <Input
            id={`f-${index}-label-ar`}
            value={field.labelAr ?? ""}
            onChange={e => onChange({ labelAr: e.target.value })}
            placeholder="يُستخدم الإنجليزي إن تُرك فارغاً"
            dir="rtl"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`f-${index}-key`}>Key</Label>
          <Input
            id={`f-${index}-key`}
            value={field.key}
            onChange={e => onChange({ key: e.target.value })}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`f-${index}-type`}>Type</Label>
          <Select value={field.type} onValueChange={v => onChange(typeChangePatch(field, v as RuntimeFieldType))}>
            <SelectTrigger id={`f-${index}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <Switch checked={Boolean(field.required)} onCheckedChange={v => onChange({ required: v })} />
          <span>Required</span>
        </label>
        <Input
          placeholder="Placeholder (optional)"
          value={field.placeholder ?? ""}
          onChange={e => onChange({ placeholder: e.target.value })}
          className="flex-1 max-w-xs"
        />
      </div>

      <TypeSubEditor field={field} onChange={onChange} />
      {TYPES_WITH_VALIDATION.has(field.type) && <FieldValidationRow field={field} onChange={onChange} />}
    </div>
  )
}

/**
 * When the user changes a field's type, prune sub-configs that no longer
 * apply (so a stale `currencyConfig` on a now-boolean field doesn't get
 * serialised) and seed the new ones to sensible defaults.
 */
/**
 * Sub-config keys on RuntimeField that get pruned/seeded per type. Each
 * entry: `[configKey, appliesTo, seed]`. Keeps `typeChangePatch` linear
 * (one loop, no per-type branches at the top level) so the cyclomatic
 * complexity stays under the lint gate as new types are added.
 */
const SUBCONFIG_RULES: ReadonlyArray<{
  key: keyof RuntimeField
  applies: (t: RuntimeFieldType) => boolean
  seed: (t: RuntimeFieldType) => unknown
}> = [
  { key: "options", applies: t => TYPES_WITH_OPTIONS.has(t), seed: () => [] },
  { key: "currencyConfig", applies: t => t === "currency", seed: () => ({ currencyCode: "USD" }) },
  {
    key: "fileConfig",
    applies: t => t === "file" || t === "image",
    seed: t => defaultFileConfig(t as "file" | "image"),
  },
  {
    key: "entityAutocompleteConfig",
    applies: t => t === "entity-autocomplete",
    seed: () => ({ targetEntityName: "", displayField: "name" }),
  },
  {
    key: "enumConfig",
    applies: t => t === "enum",
    seed: () => ({ enumType: "", valueField: "id", displayField: "name" }),
  },
  {
    key: "apiAutocompleteConfig",
    applies: t => t === "api-autocomplete",
    seed: () => ({ endpoint: "", valueField: "id", labelField: "name" }),
  },
  { key: "tagsConfig", applies: t => t === "tags", seed: () => ({}) },
]

function typeChangePatch(prev: RuntimeField, next: RuntimeFieldType): Partial<RuntimeField> {
  const patch: Record<string, unknown> = { type: next }
  // Reset sub-configs that don't apply to the new type. Set to undefined
  // (not delete) so React detects the change.
  for (const rule of SUBCONFIG_RULES) {
    patch[rule.key] = rule.applies(next) ? ((prev[rule.key] as unknown) ?? rule.seed(next)) : undefined
  }
  return patch as Partial<RuntimeField>
}

function defaultFileConfig(type: "file" | "image"): RuntimeFileConfig {
  return {
    accept: type === "image" ? ["image/*"] : [],
    maxSizeKB: 5000,
  }
}

function TypeSubEditor({ field, onChange }: { field: RuntimeField; onChange: (patch: Partial<RuntimeField>) => void }) {
  if (TYPES_WITH_OPTIONS.has(field.type)) return <FieldOptionsEditor field={field} onChange={onChange} />
  if (field.type === "currency") return <CurrencyConfigEditor field={field} onChange={onChange} />
  if (field.type === "file" || field.type === "image") return <FileConfigEditor field={field} onChange={onChange} />
  if (field.type === "entity-autocomplete") return <EntityAutocompleteEditor field={field} onChange={onChange} />
  if (field.type === "enum") return <EnumConfigEditor field={field} onChange={onChange} />
  if (field.type === "api-autocomplete") return <ApiAutocompleteConfigEditor field={field} onChange={onChange} />
  if (field.type === "tags") return <TagsConfigEditor field={field} onChange={onChange} />
  return null
}

function FieldHeaderRow({ index, field, isFirst, isLast, canRemove, onMove, onRemove, onMakeTitle }: FieldEditorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Move up"
        >
          <GripVertical className="h-3 w-3 rotate-90" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Move down"
        >
          <GripVertical className="h-3 w-3 -rotate-90" />
        </button>
      </div>
      <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
      <div className="flex-1" />
      {field.isTitle ? (
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">Title field</span>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={onMakeTitle}>
          Set as title
        </Button>
      )}
      {canRemove && (
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove field">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  )
}

function FieldOptionsEditor({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  const updateOption = (i: number, patch: Partial<RuntimeFieldOption>) => {
    const next = (field.options ?? []).map((o, k) => (k === i ? { ...o, ...patch } : o))
    onChange({ options: next })
  }
  const addOption = () => {
    const next = [...(field.options ?? []), { value: `opt_${(field.options?.length ?? 0) + 1}`, label: "" }]
    onChange({ options: next })
  }
  const removeOption = (i: number) => {
    onChange({ options: (field.options ?? []).filter((_, k) => k !== i) })
  }
  const options = field.options ?? []
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Options</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addOption} className="gap-1">
          <Plus className="h-3 w-3" />
          Add option
        </Button>
      </div>
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">Add at least one option for this select field.</p>
      )}
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="Value"
            value={opt.value}
            onChange={e => updateOption(i, { value: e.target.value })}
            className="font-mono text-sm flex-1"
          />
          <Input
            placeholder="Label"
            value={opt.label}
            onChange={e => updateOption(i, { label: e.target.value })}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(i)} aria-label="Remove option">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  )
}

function CurrencyConfigEditor({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  const cfg: RuntimeCurrencyConfig = field.currencyConfig ?? {}
  const setCfg = (patch: Partial<RuntimeCurrencyConfig>) => {
    onChange({ currencyConfig: { ...cfg, ...patch } })
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">Currency code</Label>
        <Select value={cfg.currencyCode ?? "USD"} onValueChange={v => setCfg({ currencyCode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMON_CURRENCY_CODES.map(c => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Locale (optional)</Label>
        <Input
          placeholder="e.g. en-US, ar-EG"
          value={cfg.locale ?? ""}
          onChange={e => setCfg({ locale: e.target.value || undefined })}
        />
      </div>
    </div>
  )
}

function FileConfigEditor({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  const cfg: RuntimeFileConfig = field.fileConfig ?? {}
  const acceptString = (cfg.accept ?? []).join(", ")
  const setAccept = (raw: string) => {
    // The user types "image/*, application/pdf" — split on commas and trim.
    const parts = raw
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0)
    onChange({ fileConfig: { ...cfg, accept: parts.length > 0 ? parts : undefined } })
  }
  const setMaxSize = (raw: string) => {
    const n = raw === "" ? undefined : Number(raw)
    onChange({ fileConfig: { ...cfg, maxSizeKB: Number.isFinite(n) ? (n as number) : undefined } })
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">Accept patterns</Label>
        <Input
          placeholder={field.type === "image" ? "image/*" : "image/*, application/pdf"}
          value={acceptString}
          onChange={e => setAccept(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">Comma-separated MIME types or extensions.</p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Max size (KB)</Label>
        <Input
          type="number"
          placeholder="5000"
          value={cfg.maxSizeKB ?? ""}
          onChange={e => setMaxSize(e.target.value)}
        />
      </div>
    </div>
  )
}

function EntityAutocompleteEditor({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  // Read the live runtime config so the picker only offers entity ids that
  // currently exist. If the chosen target is later renamed/deleted the
  // form-level validator will catch it; we don't try to repair the value here.
  const config = useRuntimeConfig()
  const cfg: RuntimeEntityAutocompleteConfig = field.entityAutocompleteConfig ?? {
    targetEntityName: "",
    displayField: "name",
  }
  const setCfg = (patch: Partial<RuntimeEntityAutocompleteConfig>) => {
    onChange({ entityAutocompleteConfig: { ...cfg, ...patch } })
  }
  const entities = config.entities
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">Target entity</Label>
        <Select value={cfg.targetEntityName} onValueChange={v => setCfg({ targetEntityName: v })}>
          <SelectTrigger>
            <SelectValue placeholder={entities.length === 0 ? "No entities yet" : "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {entities.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.singularName} ({e.id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Display field</Label>
        <Input
          placeholder="name"
          value={cfg.displayField}
          onChange={e => setCfg({ displayField: e.target.value })}
          className="font-mono text-sm"
        />
        <p className="text-[11px] text-muted-foreground">Field on the target entity to show in the dropdown.</p>
      </div>
    </div>
  )
}

function EnumConfigEditor({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  const cfg: RuntimeEnumConfig = field.enumConfig ?? { enumType: "" }
  const setCfg = (patch: Partial<RuntimeEnumConfig>) => {
    onChange({ enumConfig: { ...cfg, ...patch } })
  }
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="space-y-1">
        <Label className="text-xs">Enum type</Label>
        <Select value={cfg.enumType} onValueChange={v => setCfg({ enumType: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {ENUM_TYPE_NAMES.map(name => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Value field</Label>
        <Select value={cfg.valueField ?? "id"} onValueChange={v => setCfg({ valueField: v as "id" | "code" })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="id">id</SelectItem>
            <SelectItem value="code">code</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Display field</Label>
        <Select
          value={cfg.displayField ?? "name"}
          onValueChange={v => setCfg({ displayField: v as "name" | "foreignName" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">name</SelectItem>
            <SelectItem value="foreignName">foreignName</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function ApiAutocompleteConfigEditor({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  const cfg: RuntimeApiAutocompleteConfig = field.apiAutocompleteConfig ?? {
    endpoint: "",
    valueField: "id",
    labelField: "name",
  }
  const setCfg = (patch: Partial<RuntimeApiAutocompleteConfig>) => {
    onChange({ apiAutocompleteConfig: { ...cfg, ...patch } })
  }
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Endpoint</Label>
        <Input
          placeholder="/api/app/some-resource"
          value={cfg.endpoint}
          onChange={e => setCfg({ endpoint: e.target.value })}
          className="font-mono text-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          URL hit on mount. Response: array of rows, or {`{ items: [...] }`}.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Value field</Label>
          <Input
            placeholder="id"
            value={cfg.valueField}
            onChange={e => setCfg({ valueField: e.target.value })}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Label field</Label>
          <Input
            placeholder="name"
            value={cfg.labelField}
            onChange={e => setCfg({ labelField: e.target.value })}
            className="font-mono text-sm"
          />
        </div>
      </div>
    </div>
  )
}

function TagsConfigEditor({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  const cfg: RuntimeTagsConfig = field.tagsConfig ?? {}
  const setCfg = (patch: Partial<RuntimeTagsConfig>) => {
    onChange({ tagsConfig: { ...cfg, ...patch } })
  }
  const setMaxCount = (raw: string) => {
    const n = raw === "" ? undefined : Number(raw)
    setCfg({ maxCount: Number.isFinite(n) ? (n as number) : undefined })
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-xs">Max count (optional)</Label>
        <Input
          type="number"
          placeholder="No cap"
          value={cfg.maxCount ?? ""}
          onChange={e => setMaxCount(e.target.value)}
        />
      </div>
      <label className="inline-flex items-center gap-2 self-end pb-2 text-sm">
        <Switch checked={Boolean(cfg.allowDuplicates)} onCheckedChange={v => setCfg({ allowDuplicates: v })} />
        <span>Allow duplicate tags</span>
      </label>
    </div>
  )
}

function FieldValidationRow({
  field,
  onChange,
}: {
  field: RuntimeField
  onChange: (patch: Partial<RuntimeField>) => void
}) {
  const isNumeric = field.type === "number" || field.type === "currency" || field.type === "percentage"
  const minKey = isNumeric ? "min" : "minLength"
  const maxKey = isNumeric ? "max" : "maxLength"
  const setBound = (key: typeof minKey | typeof maxKey, raw: string) => {
    const v = raw === "" ? undefined : Number(raw)
    onChange({ validation: { ...field.validation, [key]: v } })
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input
        type="number"
        placeholder={isNumeric ? "Min value" : "Min length"}
        value={field.validation?.[minKey] ?? ""}
        onChange={e => setBound(minKey, e.target.value)}
      />
      <Input
        type="number"
        placeholder={isNumeric ? "Max value" : "Max length"}
        value={field.validation?.[maxKey] ?? ""}
        onChange={e => setBound(maxKey, e.target.value)}
      />
    </div>
  )
}
