/**
 * Translate a RuntimeEntity (the JSON-blob format the in-browser builder
 * produces) into an EntityBuilderSchema (the format the existing code
 * generator already understands).
 *
 * Pure function, no I/O — deterministic so the materialize endpoint can
 * compute a stable diff before writing.
 *
 * Limitations are documented inline rather than fixed silently:
 *   • Arabic labels (field.labelAr, entity.pluralNameAr / singularNameAr /
 *     descriptionAr) are emitted when the author provided them; otherwise
 *     we fall back to the English value so the schema still validates. This
 *     replaces the old "mirror English into ar" behaviour.
 *   • RuntimeEntity has no `domain`. We default to `"runtime"` so every
 *     materialised entity lands in `src/domains/runtime/<name>/`. Pass
 *     `domain` in `MapOptions` to override.
 *   • Validation rules with `customValidator`, `entity-autocomplete` /
 *     `api-autocomplete` field types, and other advanced features are
 *     not reachable from the runtime builder UI yet — the mapper just
 *     omits them.
 */

import {
  deriveEndpoint,
  derivePermissionKey,
  pluralizeEnglish,
  toKebabCase,
} from "@/features/admin-tools/entity-builder/server/derivations"
import type {
  BulkActionDefinition,
  EntityBuilderSchema,
  EntityFieldDefinition,
  FieldType,
  FilterDefinition,
  ListColumnDefinition,
  ValidationRules,
} from "@/features/admin-tools/entity-builder/types/builder-schema"
import type {
  RuntimeBulkAction,
  RuntimeEntity,
  RuntimeFeatures,
  RuntimeField,
  RuntimeFieldType,
  RuntimeFilter,
} from "../types"

export interface MapOptions {
  /** Folder under `src/domains/` to write the generated files into. */
  domain?: string
}

const TYPE_MAP: Record<RuntimeFieldType, FieldType> = {
  text: "string",
  textarea: "text",
  richtext: "richtext",
  number: "number",
  currency: "currency",
  percentage: "percentage",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  time: "time",
  select: "select",
  "multi-select": "multi-select",
  "entity-autocomplete": "entity-autocomplete",
  file: "file",
  image: "image",
  phone: "phone",
  email: "email",
  url: "url",
  color: "color",
  enum: "enum",
  "api-autocomplete": "api-autocomplete",
  tags: "tags",
}

const LIST_DISPLAY_MAP: Record<FieldType, ListColumnDefinition["display"]> = {
  string: "text",
  text: "text",
  richtext: "text",
  number: "text",
  currency: "currency",
  percentage: "percentage",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  time: "text",
  select: "badge",
  "multi-select": "tags",
  enum: "badge",
  "entity-autocomplete": "text",
  "api-autocomplete": "text",
  file: "text",
  image: "image",
  phone: "text",
  email: "text",
  url: "text",
  color: "text",
  tags: "tags",
}

function mapValidation(field: RuntimeField): ValidationRules | undefined {
  const v = field.validation
  if (!v) return undefined
  const out: ValidationRules = {}
  if (v.min != null) out.min = v.min
  if (v.max != null) out.max = v.max
  if (v.minLength != null) out.minLength = v.minLength
  if (v.maxLength != null) out.maxLength = v.maxLength
  if (v.pattern) out.pattern = v.pattern
  return Object.keys(out).length === 0 ? undefined : out
}

function mapField(field: RuntimeField, entityName: string): EntityFieldDefinition {
  const type = TYPE_MAP[field.type]
  const label = { en: field.label, ar: field.labelAr?.trim() || field.label }
  const placeholder = field.placeholder ? { en: field.placeholder, ar: field.placeholder } : undefined

  const out: EntityFieldDefinition = {
    name: field.key,
    type,
    label,
    ...(placeholder ? { placeholder } : {}),
    ...(field.required ? { required: true } : {}),
    ...(mapValidation(field) ? { validation: mapValidation(field)! } : {}),
  }

  carryPerTypeExtras(out, field, entityName)
  return out
}

function carrySelectOptions(out: EntityFieldDefinition, field: RuntimeField, entityName: string): void {
  if ((field.type !== "select" && field.type !== "multi-select") || !field.options) return
  // EntityBuilderSchema expects each option to have a labelKey (an i18n
  // path). The runtime builder stores literal labels — we synthesize a
  // namespaced labelKey so the generated translations file has a stable
  // home for them.
  out.options = field.options.map(opt => ({
    value: opt.value,
    labelKey: `pages.${entityName}.options.${field.key}.${opt.value}`,
  }))
}

function carryCurrency(out: EntityFieldDefinition, field: RuntimeField): void {
  if (field.type === "currency" && field.currencyConfig?.currencyCode) {
    out.currencyCode = field.currencyConfig.currencyCode
  }
}

function carryFile(out: EntityFieldDefinition, field: RuntimeField): void {
  if ((field.type !== "file" && field.type !== "image") || !field.fileConfig) return
  if (field.fileConfig.accept && field.fileConfig.accept.length > 0) {
    // Builder schema stores a single comma-separated string; the runtime
    // type is an array for UX ergonomics. Join here.
    out.accept = field.fileConfig.accept.join(",")
  }
  if (field.fileConfig.maxSizeKB != null) {
    out.maxSizeKB = field.fileConfig.maxSizeKB
  }
}

function carryEntityAutocomplete(out: EntityFieldDefinition, field: RuntimeField): void {
  if (field.type !== "entity-autocomplete" || !field.entityAutocompleteConfig) return
  out.entityRef = field.entityAutocompleteConfig.targetEntityName
  out.displayField = field.entityAutocompleteConfig.displayField
}

function carryEnum(out: EntityFieldDefinition, field: RuntimeField): void {
  // Builder-schema's `enumName` is the same string as the runtime
  // `enumType` — both are passed to `/api/app/enum/${name}`. Server-side
  // Zod (builder-schema.ts:177) validates it through IDENT_PATTERNS.enumName.
  if (field.type === "enum" && field.enumConfig?.enumType) {
    out.enumName = field.enumConfig.enumType
  }
}

function carryApiAutocomplete(out: EntityFieldDefinition, field: RuntimeField): void {
  if (field.type !== "api-autocomplete" || !field.apiAutocompleteConfig) return
  // Builder-schema's `apiConfig` has more knobs than the runtime config
  // exposes — supply the documented defaults for queryParam ("q") and
  // itemsPath ("items") so the schema's Zod defaults apply. foreignLabelField
  // is genuinely optional and left unset.
  const rc = field.apiAutocompleteConfig
  out.apiConfig = {
    endpoint: rc.endpoint,
    queryParam: "q",
    itemsPath: "items",
    valueField: rc.valueField,
    labelField: rc.labelField,
  }
}

function carryTags(out: EntityFieldDefinition, field: RuntimeField): void {
  if (field.type !== "tags" || !field.tagsConfig) return
  // Mirror the carryEnum / carryCurrency pattern: only emit the extras
  // block when at least one knob is actually configured, so an empty
  // tagsConfig doesn't show up as `tagsConfig: {}` in the materialized
  // schema or the generated source.
  const rc = field.tagsConfig
  const hasMaxCount = rc.maxCount !== undefined
  const hasAllowDuplicates = rc.allowDuplicates === true
  if (!hasMaxCount && !hasAllowDuplicates) return
  out.tagsConfig = {
    ...(hasMaxCount ? { maxCount: rc.maxCount } : {}),
    ...(hasAllowDuplicates ? { allowDuplicates: true } : {}),
  }
}

/**
 * Copy the type-conditional sub-configs the runtime UI captured onto the
 * builder-schema field. The builder schema's Zod validates everything we
 * touch here, so a bad `currencyCode` or `accept` pattern fails materialize
 * loudly rather than silently being emitted as bogus source.
 */
function carryPerTypeExtras(out: EntityFieldDefinition, field: RuntimeField, entityName: string): void {
  carrySelectOptions(out, field, entityName)
  carryCurrency(out, field)
  carryFile(out, field)
  carryEntityAutocomplete(out, field)
  carryEnum(out, field)
  carryApiAutocomplete(out, field)
  carryTags(out, field)
}

function mapFeatures(features: RuntimeFeatures | undefined): EntityBuilderSchema["features"] {
  return {
    create: features?.create ?? true,
    edit: features?.edit ?? true,
    delete: features?.delete ?? true,
    view: features?.view ?? true,
    export: features?.export ?? false,
    import: features?.import ?? false,
  }
}

function mapFilter(filter: RuntimeFilter): FilterDefinition {
  return {
    field: filter.field,
    operator: filter.operator,
    ...(filter.widget ? { widget: filter.widget } : {}),
    ...(filter.label ? { label: { en: filter.label, ar: filter.label } } : {}),
  }
}

function mapBulkAction(action: RuntimeBulkAction): BulkActionDefinition {
  return {
    id: action.id,
    label: { en: action.label, ar: action.label },
    action: action.kind,
    confirm: action.confirm ?? true,
    ...(action.icon ? { icon: action.icon } : {}),
  }
}

function buildListColumns(entity: RuntimeEntity, builderFields: EntityFieldDefinition[]): ListColumnDefinition[] {
  const titleFieldKey = entity.fields.find(f => f.isTitle)?.key ?? entity.fields[0]?.key
  return entity.fields.slice(0, 6).map(f => {
    const builderField = builderFields.find(bf => bf.name === f.key)!
    return {
      field: f.key,
      display: f.key === titleFieldKey ? "text-primary" : LIST_DISPLAY_MAP[builderField.type],
      sortable: true,
      hidden: false,
    }
  })
}

function buildFormLayout(entity: RuntimeEntity): { fields: string[] }[] {
  // Two-up form layout. Pair fields together so the form isn't a single
  // tall column — matches what the wizard generates by default.
  const out: { fields: string[] }[] = []
  for (let i = 0; i < entity.fields.length; i += 2) {
    const a = entity.fields[i]?.key
    const b = entity.fields[i + 1]?.key
    if (!a) continue
    out.push({ fields: b ? [a, b] : [a] })
  }
  return out
}

function buildTranslations(entity: RuntimeEntity): EntityBuilderSchema["translations"] {
  // Prefer author-provided Arabic; fall back to English so the schema still
  // validates for entities authored before the Arabic fields existed.
  const arTitle = entity.pluralNameAr?.trim() || entity.pluralName
  const arDescription = entity.descriptionAr?.trim() || entity.description || arTitle
  return {
    en: {
      title: entity.pluralName,
      description: entity.description ?? `Manage ${entity.pluralName.toLowerCase()}`,
      searchPlaceholder: `Search ${entity.pluralName.toLowerCase()}…`,
    },
    ar: {
      title: arTitle,
      description: arDescription,
      searchPlaceholder: arTitle,
    },
  }
}

export function mapRuntimeEntityToBuilderSchema(entity: RuntimeEntity, opts: MapOptions = {}): EntityBuilderSchema {
  const entityName = toKebabCase(entity.id)
  const fields = entity.fields.map(f => mapField(f, entityName))
  const filters = entity.filters?.length ? entity.filters.map(mapFilter) : undefined
  const bulkActions = entity.bulkActions?.length ? entity.bulkActions.map(mapBulkAction) : undefined

  return {
    entityName,
    entityNamePlural: toKebabCase(pluralizeEnglish(entityName)),
    domain: toKebabCase(opts.domain ?? "runtime") || "runtime",
    endpoint: deriveEndpoint(entityName),
    permissionKey: entity.permissionKey ?? derivePermissionKey(entityName),
    translations: buildTranslations(entity),
    fields,
    listColumns: buildListColumns(entity, fields),
    detailLayout: [
      {
        id: "primary",
        title: { en: entity.singularName, ar: entity.singularNameAr?.trim() || entity.singularName },
        fields: entity.fields.map(f => f.key),
        collapsible: false,
      },
    ],
    formLayout: buildFormLayout(entity),
    ...(filters ? { filters } : {}),
    ...(bulkActions ? { bulkActions } : {}),
    features: mapFeatures(entity.features),
  }
}
