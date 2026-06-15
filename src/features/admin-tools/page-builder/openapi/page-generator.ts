/**
 * Cluster → PageSchema generator (per spec §5 step 5).
 *
 * Given a `ResourceCluster` (output of `clusterEndpoints`), assemble a
 * draft page schema:
 *   - `id`         : kebab-case, derived from cluster.name + "-list"
 *   - `title`      : humanised cluster name
 *   - `permission` : best-effort `Api.<PascalCase>` from the resource name
 *   - `blocks`     : a `table` block backed by the list endpoint, with
 *                    auto-generated columns from the response item shape +
 *                    standard view/edit/delete row actions wired to the
 *                    detail/update/delete endpoints, plus a `customAction`
 *                    button per non-CRUD endpoint.
 *
 * The output is a draft — the admin reviews + tweaks in the canvas
 * before saving / materialising.
 */

import type { PageSchema } from "../schema/page-schema"
import type { ParsedEndpoint, ParsedProperty, ParsedSchema, ResourceCluster } from "./parser"
import { humanize, mapSwaggerToField } from "./field-mapper"

export interface GeneratedPage {
  schema: PageSchema
  warnings: string[]
}

export interface GeneratePageOptions {
  /** Component-schemas map from `parseSwagger(...).schemas`. Used to
   *  resolve list responses shaped like ABP's `PagedResultDto<X>` —
   *  `items[]` is `$ref`, the actual properties live under
   *  `schemas[refName]`. Omitting this option leaves columns blank. */
  schemas?: Record<string, ParsedSchema>
}

export function generatePageFromCluster(cluster: ResourceCluster, options: GeneratePageOptions = {}): GeneratedPage {
  const warnings: string[] = []
  const id = `${toKebabCase(cluster.name)}-list`
  const title = humanize(cluster.name)
  const permission = derivePermissionKey(cluster.name)

  if (!cluster.list) warnings.push(`Cluster "${cluster.name}" has no GET list endpoint — table block will be empty.`)

  const tableBlock = buildTableBlock(cluster, warnings, options.schemas ?? {})

  const schema: PageSchema = {
    id,
    version: "1.0",
    title: { en: title, ar: title },
    permission,
    layout: "full",
    blocks: [tableBlock as never],
  } as never

  return { schema, warnings }
}

interface ColumnDraft {
  field: string
  type: string
  sortable: boolean
  filterable: boolean
  hidden: boolean
}

interface RowAction {
  id: string
  label: { en: string; ar: string }
  icon: string
  variant: string
  size: string
  position: "row"
  permission?: string
  hidden: boolean
  action: Record<string, unknown>
}

interface TableBlockDraft {
  id: string
  type: "table"
  hidden: boolean
  dataSource: { type: "api"; endpoint: string; method: "GET" }
  columns: ColumnDraft[]
  pageSize: number
  searchable: boolean
  rowActions?: RowAction[]
}

function buildTableBlock(
  cluster: ResourceCluster,
  warnings: string[],
  schemas: Record<string, ParsedSchema>,
): TableBlockDraft {
  const listEndpoint = cluster.list?.path ?? cluster.basePath
  const columns = inferColumns(cluster.list?.responseSchema, warnings, schemas)
  const rowActions: RowAction[] = []

  if (cluster.detail)
    rowActions.push(
      buildRowAction("view", "Eye", "View", "ghost", { type: "navigate", href: `${cluster.basePath}/{id}` }),
    )
  if (cluster.update) {
    rowActions.push(
      buildRowAction("edit", "Pencil", "Edit", "ghost", { type: "navigate", href: `${cluster.basePath}/{id}/edit` }),
    )
  }
  if (cluster.delete) {
    rowActions.push(
      buildRowAction("delete", "Trash", "Delete", "ghost", {
        type: "api",
        method: "DELETE",
        endpoint: `${cluster.basePath}/{id}`,
        confirm: {
          title: { en: "Delete?", ar: "حذف؟" },
          message: { en: "This cannot be undone.", ar: "لا يمكن التراجع." },
          destructive: true,
        },
      }),
    )
  }
  for (const ca of cluster.customActions) {
    rowActions.push(customActionToButton(ca))
  }

  return {
    id: `${toKebabCase(cluster.name)}-table`,
    type: "table",
    hidden: false,
    dataSource: { type: "api", endpoint: listEndpoint, method: "GET" },
    columns,
    pageSize: 10,
    searchable: true,
    ...(rowActions.length ? { rowActions } : {}),
  }
}

function buildRowAction(
  id: string,
  icon: string,
  labelEn: string,
  variant: string,
  action: Record<string, unknown>,
): RowAction {
  return {
    id,
    label: { en: labelEn, ar: labelEn },
    icon,
    variant,
    size: "default",
    position: "row",
    hidden: false,
    action,
  }
}

function customActionToButton(ep: ParsedEndpoint): RowAction {
  // Custom action under /{id}/<verb>: derive a kebab id from the trailing segment.
  const trailing = ep.path.split("/").pop() ?? ep.operationId
  const kebab = toKebabCase(trailing.replace(/[{}]/g, ""))
  const label = humanize(trailing.replace(/[{}]/g, ""))
  return buildRowAction(kebab || "action", "Zap", label, "outline", {
    type: "api",
    method: ep.method,
    endpoint: ep.path,
  })
}

function inferColumns(
  responseSchema: ParsedSchema | undefined,
  warnings: string[],
  schemas: Record<string, ParsedSchema>,
): ColumnDraft[] {
  const itemSchema = unwrapListPayload(responseSchema, schemas)
  if (!itemSchema?.properties) {
    warnings.push("Could not infer item shape from list response — column list will be empty.")
    return []
  }
  const columns: ColumnDraft[] = []
  for (const [name, prop] of Object.entries(itemSchema.properties)) {
    columns.push({
      field: name,
      type: pickColumnType(prop),
      sortable: true,
      filterable: false,
      hidden: false,
    })
    if (columns.length >= 8) break // Sensible default — admin can show more.
  }
  return columns
}

function refToSchema(ref: string | undefined, schemas: Record<string, ParsedSchema>): ParsedSchema | undefined {
  if (!ref) return undefined
  const refName = ref.replace("#/components/schemas/", "")
  return schemas[refName]
}

function unwrapListPayload(
  s: ParsedSchema | undefined,
  schemas: Record<string, ParsedSchema>,
): ParsedSchema | undefined {
  if (!s) return undefined
  if (s.type === "array" && s.items) return s.items
  // ABP-style PagedResultDto: { items: <array of $ref>, totalCount }.
  const items = s.properties?.items
  if (items?.arrayItemRef) return refToSchema(items.arrayItemRef, schemas)
  if (items?.ref) return refToSchema(items.ref, schemas)
  return s
}

function pickColumnType(prop: ParsedProperty): string {
  if (prop.format === "date") return "date"
  if (prop.format === "date-time") return "datetime"
  if (prop.type === "boolean") return "boolean"
  if (prop.type === "integer" || prop.type === "number") {
    if (/amount|price|total|cost/i.test(prop.name)) return "currency"
    if (/percent/i.test(prop.name)) return "percentage"
    return "number"
  }
  if (prop.enum) return "enum"
  if (/code\b/i.test(prop.name)) return "badge-code"
  if (/status/i.test(prop.name)) return "badge-status"
  if (/name|title/i.test(prop.name)) return "text-primary"
  return "text-secondary"
}

function toKebabCase(s: string): string {
  return s
    .replace(/[_\s]+/g, "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
}

function derivePermissionKey(resourceName: string): string {
  // "orders" → "Api.Order"; "purchase-invoices" → "Api.PurchaseInvoice".
  const pascal = resourceName
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(w => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
    .join("")
    // Naïve singularisation — admin can correct in canvas.
    .replace(/ies$/i, "y")
    .replace(/s$/i, "")
  return `Api.${pascal || "Resource"}`
}

/**
 * Re-export the field mapper so consumers (the wizard UI) can call it
 * directly on the create-endpoint request body to populate a form-block.
 * The page-generator itself only emits a `table` block — Phase 5 keeps
 * scope tight, leaving "create from scratch" form pages to a follow-up.
 */
export { mapSwaggerToField }
