/**
 * Pure schema → source-file generators. Mirrors the handwritten entity files
 * (e.g. src/domains/inventory/brand/*) so a generated entity slots into the
 * existing dev workflow without special-casing.
 *
 * Outputs `{ path, content, language }[]` so the diff preview can render
 * each file's relative location, body, and syntax-highlight hint.
 *
 * **Security model**: every interpolation point in a template goes through
 * one of the helpers from `./safe-emit`:
 *
 *   • Identifier slots (PascalCase class names, lowerCamel function names,
 *     kebab-case file paths) → `safeIdent(kind, value)`. Throws if the
 *     value doesn't match the registered regex.
 *
 *   • String-literal slots (anything inside `"..."` in the emitted source)
 *     → `safeStringLit(value)`. Always emits a JSON-escaped double-quoted
 *     literal — `${alert(1)}` becomes the literal `"${alert(1)}"`, safe.
 *
 *   • Numeric-literal slots → `safeNumberLit`. Rejects NaN / Infinity.
 *
 * The Zod schema already validates these at the API boundary; the helpers
 * are defense-in-depth so a regex bug or a bypassed validator can't write
 * attacker-controlled source.
 *
 * Originally lived under `wizard/review/file-generators.ts`. Moved into
 * `server/` when the wizard UI was retired; the codegen pipeline still
 * needs them.
 */

import type {
  EntityBuilderSchema,
  EntityFieldDefinition,
  FieldType,
  ListColumnDefinition,
} from "../types/builder-schema"
import { toKebabCase, toPascalCase } from "./derivations"
import { safeIdent, safeNumberLit, safeStringLit } from "./safe-emit"

export interface GeneratedFile {
  path: string
  content: string
  language: "ts" | "tsx" | "json"
}

const HEADER = (kind: string, name: string) => `/**\n * ${name} ${kind}\n * Auto-generated from EntityBuilder.\n */\n\n`

/** Field names treated as ABP-style audit/metadata. Used to split detailSections. */
const METADATA_FIELD_NAMES = new Set([
  "creationTime",
  "creatorId",
  "lastModificationTime",
  "lastModifierId",
  "isDeleted",
])

interface NormalizedNames {
  /** kebab-case singular ("customer") — already validated by safeIdent */
  entityName: string
  /** kebab-case plural ("customers") */
  entityNamePlural: string
  /** kebab-case domain ("business") */
  domain: string
  /** PascalCase singular ("Customer") — derived, then re-asserted */
  pascal: string
  /** PascalCase plural ("Customers") */
  pluralPascal: string
  /** lowerCamelCase ("customer") */
  camel: string
}

/**
 * Validate every identifier we'll interpolate, exactly once, up front.
 * Every downstream template uses `names.*` so the regex check happens
 * before we ever touch the templates — making it impossible to forget.
 */
function normalizeNames(schema: EntityBuilderSchema): NormalizedNames {
  const entityName = safeIdent("kebab", schema.entityName)
  const entityNamePlural = safeIdent("kebab", schema.entityNamePlural)
  const domain = safeIdent("kebab", schema.domain)
  // toPascalCase / toCamel can only produce identifier-shape output when
  // their input is identifier-shape, but re-assert anyway — cheap, and
  // protects against a bug in the derivation helpers.
  const pascal = safeIdent("enumName", toPascalCase(entityName))
  const pluralPascal = safeIdent("enumName", toPascalCase(entityNamePlural))
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1)
  return { entityName, entityNamePlural, domain, pascal, pluralPascal, camel }
}

export function generateEntityFiles(schema: EntityBuilderSchema): GeneratedFile[] {
  const names = normalizeNames(schema)
  const baseDir = `src/domains/${toKebabCase(names.domain)}/${toKebabCase(names.entityName)}`
  const pageDir = `src/app/(dashboard)/${toKebabCase(names.entityNamePlural)}`
  return [
    { path: `${baseDir}/${names.entityName}.types.ts`, content: typesFile(schema, names), language: "ts" },
    { path: `${baseDir}/${names.entityName}.schema.ts`, content: schemaFile(schema, names), language: "ts" },
    { path: `${baseDir}/${names.entityName}.service.ts`, content: serviceFile(schema, names), language: "ts" },
    // .tsx (not .ts) to match the handwritten entity configs. Body has no
    // JSX today, but the icon import from lucide-react makes the .tsx
    // extension the natural fit and aligns with the project convention.
    { path: `${baseDir}/${names.entityName}.config.tsx`, content: configFile(schema, names), language: "tsx" },
    { path: `${pageDir}/page.tsx`, content: listPageFile(names), language: "tsx" },
    { path: `${pageDir}/[id]/page.tsx`, content: detailPageFile(names), language: "tsx" },
    { path: `${pageDir}/[id]/edit/page.tsx`, content: editPageFile(names), language: "tsx" },
  ]
}

function typesFile(schema: EntityBuilderSchema, names: NormalizedNames): string {
  const fieldLines = schema.fields
    .map(f => `  ${safeIdent("fieldName", f.name)}${f.required ? "" : "?"}: ${tsType(f)}`)
    .join("\n")
  return `${HEADER("types", names.pascal)}export interface ${names.pascal} {
  id: number
${fieldLines}
  concurrencyStamp?: string
  creationTime?: string
  [key: string]: unknown
}
`
}

function tsType(field: EntityFieldDefinition): string {
  switch (field.type) {
    case "boolean":
      return "boolean"
    case "number":
    case "currency":
    case "percentage":
      return "number"
    case "multi-select":
    case "tags":
      return "string[]"
    case "file":
    case "image":
      return "string | File"
    default:
      return "string"
  }
}

function schemaFile(schema: EntityBuilderSchema, names: NormalizedNames): string {
  const lines = schema.fields.map(f => `    ${safeIdent("fieldName", f.name)}: ${zodLine(f)},`).join("\n")
  return `${HEADER("Zod schema", names.pascal)}import { z } from "zod"
import type { TFunction } from "@/core/entities/schema-types"

export const get${names.pascal}CreateSchema = (t: TFunction) =>
  z.object({
${lines}
  })

export const get${names.pascal}UpdateSchema = (t: TFunction) =>
  z.object({
${lines}
    concurrencyStamp: z.string().min(1, t("common.validation.required")),
  })

export type ${names.pascal}FormValues = z.infer<ReturnType<typeof get${names.pascal}CreateSchema>>
export type ${names.pascal}UpdateFormValues = z.infer<ReturnType<typeof get${names.pascal}UpdateSchema>>
`
}

// Lookup keeps the dispatch flat — chained if/else inflates cyclomatic complexity.
// Defaults to `z.string()` for any type not listed.
const ZOD_BASE: Partial<Record<string, string>> = {
  boolean: "z.boolean()",
  number: "z.number()",
  currency: "z.number()",
  percentage: "z.number()",
  "multi-select": "z.array(z.string())",
  tags: "z.array(z.string())",
  // String-shaped but with a tighter built-in zod refinement so the
  // generated schema rejects malformed values at form-submit time.
  email: "z.string().email()",
  url: "z.string().url()",
}

function zodLine(field: EntityFieldDefinition): string {
  const parts: string[] = [ZOD_BASE[field.type] ?? "z.string()"]
  appendValidation(parts, field)
  if (!field.required) parts.push(".optional()")
  return parts.join("")
}

function appendValidation(parts: string[], field: EntityFieldDefinition): void {
  const v = field.validation
  if (!v) return
  if (v.minLength !== undefined) {
    const n = safeNumberLit(v.minLength)
    parts.push(`.min(${n}, t("errors.min_length", { min: ${n} }))`)
  }
  if (v.maxLength !== undefined) {
    const n = safeNumberLit(v.maxLength)
    parts.push(`.max(${n}, t("errors.max_length", { max: ${n} }))`)
  }
  if (v.min !== undefined) parts.push(`.min(${safeNumberLit(v.min)})`)
  if (v.max !== undefined) parts.push(`.max(${safeNumberLit(v.max)})`)
}

function serviceFile(schema: EntityBuilderSchema, names: NormalizedNames): string {
  return `${HEADER("service", names.pascal)}import { BaseCRUDService } from "@/infra/api/crud-service"
import type { ${names.pascal}FormValues, ${names.pascal}UpdateFormValues } from "./${names.entityName}.schema"
import type { ${names.pascal} } from "./${names.entityName}.types"

export type { ${names.pascal} } from "./${names.entityName}.types"

class ${names.pascal}Service extends BaseCRUDService<${names.pascal}, ${names.pascal}FormValues, ${names.pascal}UpdateFormValues> {
  constructor() {
    super(${safeStringLit(safeIdent("endpoint", schema.endpoint))})
  }
}

export const ${names.camel}Service = new ${names.pascal}Service()
`
}

// ─── Builder-type → EntityConfig-type mappings ──────────────────────────────
//
// EntityConfig.formFields.type uses `EntityConfigFieldType` (13 values, see
// src/core/entities/field-types.ts). EntityBuilderSchema uses the broader
// `BuilderSchemaFieldType` (22 values). Map only here — every downstream
// emit goes through `formFieldType(field)`.

const FORM_FIELD_TYPE_MAP: Record<FieldType, string> = {
  string: "text",
  text: "textarea",
  richtext: "textarea",
  number: "number",
  currency: "number",
  percentage: "number",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  time: "text",
  select: "select",
  "multi-select": "select",
  enum: "enum",
  "entity-autocomplete": "autocomplete",
  "api-autocomplete": "autocomplete",
  file: "file",
  image: "file",
  phone: "text",
  email: "email",
  url: "text",
  color: "text",
  tags: "tags",
}

// `ColumnMetadata.type` + `FieldConfig.type` both use `FieldRendererType` (=
// RendererColumnType, 18 values). The builder's `listColumns[].display`
// enum has 12 values, 4 of which aren't renderable — map them to the
// closest renderer-recognised stand-in.
const RENDERER_TYPE_FOR_DISPLAY: Record<ListColumnDefinition["display"], string> = {
  text: "text-secondary",
  "text-primary": "text-primary",
  "text-arabic": "text-arabic",
  badge: "badge",
  "badge-code": "badge-code",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  currency: "currency",
  percentage: "number",
  // RendererColumnType has no first-class image/tags rendering today — fall
  // back to text-secondary so the column at least shows the raw value.
  image: "text-secondary",
  tags: "text-secondary",
}

const RENDERER_TYPE_FOR_FIELD: Record<FieldType, string> = {
  string: "text-secondary",
  text: "text-secondary",
  richtext: "text-secondary",
  number: "number",
  currency: "currency",
  percentage: "number",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  time: "text-secondary",
  select: "badge",
  "multi-select": "badge",
  enum: "enum",
  "entity-autocomplete": "relation",
  "api-autocomplete": "relation",
  file: "text-secondary",
  image: "text-secondary",
  phone: "text-secondary",
  email: "text-secondary",
  url: "text-secondary",
  color: "text-secondary",
  tags: "text-secondary",
}

// JS-literal source for the per-field defaultFormValues entry. Strings get
// `""`, numbers `0`, booleans `false`, array-of-string types `[]`, and
// anything where we can't pick a sensible default (date, file, enum…) gets
// `undefined`. Matches the user's per-type contract for defaultFormValues.
const DEFAULT_FORM_VALUE_LITERAL: Record<FieldType, string> = {
  string: `""`,
  text: `""`,
  richtext: `""`,
  number: "0",
  currency: "0",
  percentage: "0",
  boolean: "false",
  date: "undefined",
  datetime: "undefined",
  time: `""`,
  select: "undefined",
  "multi-select": "[]",
  enum: "undefined",
  "entity-autocomplete": "undefined",
  "api-autocomplete": "undefined",
  file: "undefined",
  image: "undefined",
  phone: `""`,
  email: `""`,
  url: `""`,
  color: `""`,
  tags: "[]",
}

// Coercion expression for the entityToFormData transformer. Mirrors the
// shape of the defaultFormValues — keeps every form value well-typed when
// editing an entity that has null/undefined fields on the wire.
function entityToFormCoercion(field: EntityFieldDefinition, entityRef: string): string {
  const accessor = `${entityRef}.${safeIdent("fieldName", field.name)}`
  const literal = DEFAULT_FORM_VALUE_LITERAL[field.type]
  // Booleans default to false but `false || x` is buggy — use ??.
  if (literal === "false") return `${accessor} ?? false`
  if (literal === "0") return `${accessor} ?? 0`
  if (literal === "[]") return `${accessor} ?? []`
  if (literal === "undefined") return accessor
  // String-shaped defaults: empty string for null/undefined.
  return `${accessor} || ""`
}

// Builder field types that contribute to the searchable-text columns the
// table toolbar searches across. Free-text-typeable fields only — date,
// boolean, file etc. aren't useful as fulltext targets.
const SEARCHABLE_FIELD_TYPES = new Set<FieldType>(["string", "text", "richtext", "select", "email", "phone", "url"])

// ─── Config emission helpers ───────────────────────────────────────────────

interface ConfigPartials {
  listColumns: string
  searchFields: string
  defaultSort: string
  detailSections: string
  formFields: string
  formFieldOrder: string
  defaultFormValues: string
  entityToFormData: string
  formLayout: string
  translations: string
}

function buildListColumnsBlock(schema: EntityBuilderSchema, names: NormalizedNames): string {
  const visible = schema.listColumns.filter(col => !col.hidden)
  const lines = visible.map(col => {
    const field = safeStringLit(safeIdent("fieldName", col.field))
    const type = safeStringLit(RENDERER_TYPE_FOR_DISPLAY[col.display])
    const titleKey = safeStringLit(`pages.${names.entityName}.${safeIdent("fieldName", col.field)}`)
    return `    { field: ${field}, type: ${type}, titleKey: ${titleKey} },`
  })
  return `[\n${lines.join("\n")}\n  ]`
}

function buildSearchFieldsBlock(schema: EntityBuilderSchema): string {
  const fields = schema.fields.filter(f => SEARCHABLE_FIELD_TYPES.has(f.type))
  if (fields.length === 0) return "[]"
  const items = fields.map(f => safeStringLit(safeIdent("fieldName", f.name))).join(", ")
  return `[${items}]`
}

function buildDefaultSortBlock(schema: EntityBuilderSchema): string | null {
  const hasCreationTime = schema.fields.some(f => f.name === "creationTime")
  if (!hasCreationTime) return null
  // The field name is hardcoded so we don't need safeStringLit here, but
  // do go through it to keep the "all literals are JSON.stringify'd" rule
  // uniform across the module.
  return `{ field: ${safeStringLit("creationTime")}, direction: ${safeStringLit("desc")} }`
}

function buildDetailSectionsBlock(schema: EntityBuilderSchema, names: NormalizedNames): string {
  const primary = schema.fields.filter(f => !f.hidden && !METADATA_FIELD_NAMES.has(f.name))
  const metadata = schema.fields.filter(f => METADATA_FIELD_NAMES.has(f.name))

  const fieldLine = (f: EntityFieldDefinition): string => {
    const name = safeStringLit(safeIdent("fieldName", f.name))
    const type = safeStringLit(RENDERER_TYPE_FOR_FIELD[f.type])
    const labelKey = safeStringLit(`pages.${names.entityName}.${safeIdent("fieldName", f.name)}`)
    return `        { name: ${name}, type: ${type}, labelKey: ${labelKey} },`
  }

  const sections: string[] = []
  if (primary.length > 0) {
    sections.push(`    {
      title: ${safeStringLit("primary_information")},
      fields: [
${primary.map(fieldLine).join("\n")}
      ],
    },`)
  }
  if (metadata.length > 0) {
    sections.push(`    {
      title: ${safeStringLit("metadata")},
      fields: [
${metadata.map(fieldLine).join("\n")}
      ],
    },`)
  }
  return `[\n${sections.join("\n")}\n  ]`
}

function buildFormFieldsBlock(schema: EntityBuilderSchema, names: NormalizedNames): string {
  const fieldEntries = schema.fields.map(f => {
    const name = safeIdent("fieldName", f.name)
    const type = safeStringLit(FORM_FIELD_TYPE_MAP[f.type])
    const labelKey = safeStringLit(`pages.${names.entityName}.${name}`)
    const placeholder = safeStringLit(`pages.${names.entityName}.${name}_placeholder`)
    const required = f.required ? ", required: true" : ""
    const extras = formFieldExtras(f)
    return `    ${name}: { type: ${type}, labelKey: ${labelKey}, placeholder: ${placeholder}${required}${extras} },`
  })
  // concurrencyStamp is on every ABP entity but never user-facing — emit it
  // hidden so the form engine doesn't render it but does pass it on update.
  fieldEntries.push(`    concurrencyStamp: { type: "text", hidden: true },`)
  return `{\n${fieldEntries.join("\n")}\n  }`
}

/**
 * Per-type extras emitted on the FormFieldConfig literal:
 *
 *   - multi-select   → multiple: true
 *   - currency       → currencyCode: "USD"
 *   - file/image     → accept: "image/*,…", maxSizeKB: 5000
 *   - entity-autocompl → entityName: "city", displayField: "name"
 *   - select         → options: [...]  (re-emitted from labelKey-bearing form)
 *
 * Each extra is wrapped through safeStringLit / safeNumberLit / safeIdent so
 * a malformed value from the builder schema (e.g. currencyCode "USD'; rm -rf")
 * fails at the safe-emit gate before any source is written.
 */
function formFieldExtras(field: EntityFieldDefinition): string {
  const out: string[] = []
  if (field.type === "multi-select") {
    out.push(`multiple: true`)
  }
  if (field.currencyCode !== undefined) {
    out.push(`currencyCode: ${safeStringLit(field.currencyCode)}`)
  }
  if (field.accept !== undefined) {
    out.push(`accept: ${safeStringLit(field.accept)}`)
  }
  if (field.maxSizeKB !== undefined) {
    out.push(`maxSizeKB: ${safeNumberLit(field.maxSizeKB)}`)
  }
  if (field.entityRef !== undefined) {
    // `entityRef` on the builder schema becomes `entityName` on
    // FormFieldConfig — both refer to "the target entity to autocomplete
    // against". Going through safeIdent("kebab", …) re-validates the
    // shape one last time inside the codegen template.
    out.push(`entityName: ${safeStringLit(safeIdent("kebab", field.entityRef))}`)
  }
  if (field.displayField !== undefined) {
    out.push(`displayField: ${safeStringLit(safeIdent("fieldName", field.displayField))}`)
  }
  if (field.enumName !== undefined) {
    // FormFieldConfig.enumType is typed as EnumTypeName. The builder
    // schema's Zod (builder-schema.ts:177) has already validated the value
    // against IDENT_PATTERNS.enumName; safeStringLit JSON-escapes it.
    out.push(`enumType: ${safeStringLit(field.enumName)}`)
  }
  if (field.apiConfig !== undefined) {
    // FormFieldConfig has slots for `customEndpoint` and (optionally)
    // `valueKey`. It has no slot for labelField — the form-field engine's
    // autocomplete renderer uses `name`/`foreignName` by convention. If a
    // consumer needs a different label field on the generated form, they
    // hand-edit the config after materialize.
    out.push(`customEndpoint: ${safeStringLit(field.apiConfig.endpoint)}`)
    if (field.apiConfig.valueField !== "id") {
      out.push(`valueKey: ${safeStringLit(safeIdent("fieldName", field.apiConfig.valueField))}`)
    }
  }
  if (field.tagsConfig !== undefined) {
    // Both knobs are optional on the runtime side; only emit each when
    // explicitly set so handwritten configs that omit them stay minimal.
    if (field.tagsConfig.maxCount !== undefined) {
      out.push(`maxCount: ${safeNumberLit(field.tagsConfig.maxCount)}`)
    }
    if (field.tagsConfig.allowDuplicates === true) {
      out.push(`allowDuplicates: true`)
    }
  }
  return out.length === 0 ? "" : `, ${out.join(", ")}`
}

function buildFormFieldOrderBlock(schema: EntityBuilderSchema): string {
  const items = schema.fields.map(f => safeStringLit(safeIdent("fieldName", f.name))).join(", ")
  return `[${items}]`
}

function buildDefaultFormValuesBlock(schema: EntityBuilderSchema): string {
  const lines = schema.fields.map(f => {
    const name = safeIdent("fieldName", f.name)
    return `    ${name}: ${DEFAULT_FORM_VALUE_LITERAL[f.type]},`
  })
  return `{\n${lines.join("\n")}\n  }`
}

function buildEntityToFormDataBlock(schema: EntityBuilderSchema, names: NormalizedNames): string {
  const entityRef = "entity"
  const lines = schema.fields.map(f => {
    const name = safeIdent("fieldName", f.name)
    return `    ${name}: ${entityToFormCoercion(f, entityRef)},`
  })
  lines.push(`    concurrencyStamp: ${entityRef}.concurrencyStamp,`)
  return `(${entityRef}: ${names.pascal}) => ({
${lines.join("\n")}
  })`
}

function buildFormLayoutBlock(schema: EntityBuilderSchema, names: NormalizedNames): string {
  if (schema.formLayout.length === 0) {
    // Sensible default: a 2-column grid. The user can later promote this
    // to a `sections` layout once they know how they want the form chunked.
    return `{
    type: ${safeStringLit("grid")},
    columns: 2,
  }`
  }
  const sections = schema.formLayout.map((row, i) => {
    const id = safeStringLit(safeIdent("id", row.id ?? `section_${i + 1}`))
    const titleKey = safeStringLit(`pages.${names.entityName}.section_${i + 1}_title`)
    const fields = row.fields.map(name => safeStringLit(safeIdent("fieldName", name))).join(", ")
    // Clamp columns to {1,2,3,4} — the FormFieldConfig type only accepts those.
    const cols = Math.min(Math.max(row.columnCount ?? row.fields.length, 1), 4)
    return `      {
        id: ${id},
        titleKey: ${titleKey},
        fields: [${fields}],
        columns: ${safeNumberLit(cols)},
      },`
  })
  return `{
    type: ${safeStringLit("sections")},
    sections: [
${sections.join("\n")}
    ],
  }`
}

function buildTranslationsBlock(names: NormalizedNames): string {
  const prefix = `pages.${names.entityName}`
  const entry = (k: string, suffix: string) => `    ${k}: ${safeStringLit(`${prefix}.${suffix}`)},`
  return `{
${entry("listTitle", "title")}
${entry("listDescription", "description")}
${entry("detailTitle", "detail_title")}
${entry("createTitle", "create_title")}
${entry("editTitle", "edit_title")}
${entry("searchPlaceholder", "searchPlaceholder")}
${entry("successCreate", "create_success")}
${entry("successUpdate", "update_success")}
${entry("successDelete", "delete_success")}
  }`
}

function buildConfigPartials(schema: EntityBuilderSchema, names: NormalizedNames): ConfigPartials {
  return {
    listColumns: buildListColumnsBlock(schema, names),
    searchFields: buildSearchFieldsBlock(schema),
    defaultSort: buildDefaultSortBlock(schema) ?? "",
    detailSections: buildDetailSectionsBlock(schema, names),
    formFields: buildFormFieldsBlock(schema, names),
    formFieldOrder: buildFormFieldOrderBlock(schema),
    defaultFormValues: buildDefaultFormValuesBlock(schema),
    entityToFormData: buildEntityToFormDataBlock(schema, names),
    formLayout: buildFormLayoutBlock(schema, names),
    translations: buildTranslationsBlock(names),
  }
}

function configFile(schema: EntityBuilderSchema, names: NormalizedNames): string {
  const p = buildConfigPartials(schema, names)
  const permissionKey = safeStringLit(safeIdent("permissionKey", schema.permissionKey))
  const basePath = safeStringLit(`/${names.entityNamePlural}`)
  const entityName = safeStringLit(names.entityName)
  const singularName = safeStringLit(names.pascal)
  const pluralName = safeStringLit(names.pluralPascal)
  const defaultSortLine = p.defaultSort ? `\n  defaultSort: ${p.defaultSort},` : ""

  return `${HEADER("entity config", names.pascal)}import { Box } from "lucide-react"
import type { EntityConfig } from "@/core/entities/config-types"
import {
  get${names.pascal}CreateSchema,
  get${names.pascal}UpdateSchema,
  type ${names.pascal}FormValues,
} from "./${names.entityName}.schema"
import { ${names.camel}Service, type ${names.pascal} } from "./${names.entityName}.service"

export const ${names.camel}Config: EntityConfig<${names.pascal}, ${names.pascal}FormValues> = {
  entityName: ${entityName},
  singularName: ${singularName},
  pluralName: ${pluralName},
  icon: Box,
  service: ${names.camel}Service,
  permissionKey: ${permissionKey},
  basePath: ${basePath},

  listColumns: ${p.listColumns},

  searchFields: ${p.searchFields},
  defaultPageSize: 10,${defaultSortLine}

  detailSections: ${p.detailSections},

  formFields: ${p.formFields},

  formFieldOrder: ${p.formFieldOrder},
  excludeFields: [${safeStringLit("concurrencyStamp")}],

  formLayout: ${p.formLayout},

  createSchema: get${names.pascal}CreateSchema,
  updateSchema: get${names.pascal}UpdateSchema,

  defaultFormValues: ${p.defaultFormValues},

  entityToFormData: ${p.entityToFormData},

  translations: ${p.translations},

  features: ${JSON.stringify(schema.features)},
}
`
}

function listPageFile(names: NormalizedNames): string {
  return `${HEADER("list page", names.entityName)}import { Suspense } from "react"
import { ConfigDrivenListPage } from "@/core/crud/components/ConfigDrivenListPage"
import { DataTableSkeleton } from "@/ui/skeletons/DataTableSkeleton"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"

export default function Page() {
  return (
    <PagePermissionGuard entityName=${safeStringLit(names.entityName)} action="view">
      <Suspense fallback={<DataTableSkeleton />}>
        <ConfigDrivenListPage entityConfigName=${safeStringLit(names.entityName)} />
      </Suspense>
    </PagePermissionGuard>
  )
}
`
}

function detailPageFile(names: NormalizedNames): string {
  return `${HEADER("detail page", names.entityName)}import { Suspense } from "react"
import { ConfigDrivenDetailPage } from "@/core/crud/components/ConfigDrivenDetailPage"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PagePermissionGuard entityName=${safeStringLit(names.entityName)} action="view">
      <Suspense fallback={<FormSkeleton />}>
        <ConfigDrivenDetailPage entityConfigName=${safeStringLit(names.entityName)} id={id} />
      </Suspense>
    </PagePermissionGuard>
  )
}
`
}

function editPageFile(names: NormalizedNames): string {
  return `${HEADER("edit page", names.entityName)}import { Suspense } from "react"
import { ConfigDrivenEditPage } from "@/core/crud/components/ConfigDrivenEditPage"
import { PagePermissionGuard } from "@/core/auth/guards/PagePermissionGuard"
import { FormSkeleton } from "@/ui/skeletons/FormSkeleton"

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PagePermissionGuard entityName=${safeStringLit(names.entityName)} action="update">
      <Suspense fallback={<FormSkeleton />}>
        <ConfigDrivenEditPage entityConfigName=${safeStringLit(names.entityName)} id={id === "create" ? undefined : id} />
      </Suspense>
    </PagePermissionGuard>
  )
}
`
}
