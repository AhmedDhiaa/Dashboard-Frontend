/**
 * Minimal OpenAPI 3.x parser + endpoint clusterer (per spec §5).
 *
 * Reads the JSON shape directly — no third-party parser library. We use
 * `openapi-types` only for *type* definitions; runtime work is hand-rolled.
 *
 * Two-stage pipeline:
 *   1. `parseSwagger(doc)` walks `paths` + `components.schemas` and produces
 *      a flat `ParsedEndpoint[]` plus a denormalised `schemas` map.
 *   2. `clusterEndpoints(endpoints)` groups related endpoints by their
 *      base path (`/api/app/orders/{id}/close` → cluster `orders`) and
 *      classifies each member as list / create / detail / update / delete /
 *      custom-action.
 *
 * The proxy route at `/api/admin/page-builder/proxy-swagger` calls
 * `fetchSwaggerJson(url)` which is the small server-side `fetch` wrapper —
 * it handles auth-less network IO + caching, see `proxy-swagger/route.ts`.
 */

import type { OpenAPIV3 } from "openapi-types"

// ─── Types ──────────────────────────────────────────────────────────────────

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

export interface ParsedProperty {
  name: string
  type: string
  format?: string
  required: boolean
  description?: string
  enum?: unknown[]
  ref?: string
  /** Populated when `type === "array"` and the items entry is a $ref. */
  arrayItemRef?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
}

export interface ParsedSchema {
  type: "object" | "array" | "primitive"
  properties?: Record<string, ParsedProperty>
  items?: ParsedSchema
  /** Original ref for downstream display ("#/components/schemas/Foo"). */
  ref?: string
}

export interface ParsedParam {
  name: string
  in: "path" | "query"
  type: string
  format?: string
  required: boolean
  description?: string
}

export interface ParsedEndpoint {
  operationId: string
  method: HttpMethod
  path: string
  summary?: string
  tags: string[]
  requestSchema?: ParsedSchema
  responseSchema?: ParsedSchema
  pathParams: ParsedParam[]
  queryParams: ParsedParam[]
}

export interface ResourceCluster {
  /** Derived from the longest non-parameter prefix (e.g. `orders`). */
  name: string
  /** Full base path (`/api/app/orders`). */
  basePath: string
  list?: ParsedEndpoint
  create?: ParsedEndpoint
  detail?: ParsedEndpoint
  update?: ParsedEndpoint
  delete?: ParsedEndpoint
  customActions: ParsedEndpoint[]
}

export interface ParseResult {
  endpoints: ParsedEndpoint[]
  schemas: Record<string, ParsedSchema>
  /** Top-level info from the OpenAPI doc — useful in the wizard header. */
  info?: { title?: string; version?: string }
}

// ─── parseSwagger ───────────────────────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]

export function parseSwagger(doc: OpenAPIV3.Document): ParseResult {
  const schemas = parseComponentSchemas(doc)
  const endpoints: ParsedEndpoint[] = []

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item) continue
    const pathItem = item as OpenAPIV3.PathItemObject
    // Path-item-level parameters apply to every operation under this path —
    // merge them onto each operation so ParsedEndpoint sees the full list.
    const inheritedParams = (pathItem.parameters ?? []) as (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[]
    for (const method of HTTP_METHODS) {
      const op = pathItem[method.toLowerCase() as keyof OpenAPIV3.PathItemObject] as
        | OpenAPIV3.OperationObject
        | undefined
      if (!op) continue
      const merged: OpenAPIV3.OperationObject = {
        ...op,
        parameters: [...inheritedParams, ...(op.parameters ?? [])],
      }
      endpoints.push(parseOperation(path, method, merged, doc))
    }
  }

  return { endpoints, schemas, info: { title: doc.info?.title, version: doc.info?.version } }
}

function parseOperation(
  path: string,
  method: HttpMethod,
  op: OpenAPIV3.OperationObject,
  doc: OpenAPIV3.Document,
): ParsedEndpoint {
  return {
    operationId: op.operationId ?? deriveOperationId(method, path),
    method,
    path,
    summary: op.summary,
    tags: op.tags ?? [],
    requestSchema: extractRequestSchema(op, doc),
    responseSchema: extractResponseSchema(op, doc),
    pathParams: extractParams(op, doc, "path"),
    queryParams: extractParams(op, doc, "query"),
  }
}

function deriveOperationId(method: HttpMethod, path: string): string {
  return `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`
}

function extractParams(
  op: OpenAPIV3.OperationObject,
  doc: OpenAPIV3.Document,
  location: "path" | "query",
): ParsedParam[] {
  const params = op.parameters ?? []
  const out: ParsedParam[] = []
  for (const raw of params) {
    const p = resolveRef<OpenAPIV3.ParameterObject>(raw, doc)
    if (!p || p.in !== location) continue
    const schema = p.schema ? resolveRef<OpenAPIV3.SchemaObject>(p.schema, doc) : undefined
    out.push({
      name: p.name,
      in: location,
      type: schema?.type ?? "string",
      format: schema?.format,
      required: !!p.required,
      description: p.description,
    })
  }
  return out
}

function extractRequestSchema(op: OpenAPIV3.OperationObject, doc: OpenAPIV3.Document): ParsedSchema | undefined {
  const body = op.requestBody as OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject | undefined
  if (!body) return undefined
  const resolved = resolveRef<OpenAPIV3.RequestBodyObject>(body, doc)
  const json = resolved?.content?.["application/json"]
  if (!json?.schema) return undefined
  return parseSchemaObject(json.schema, doc)
}

function extractResponseSchema(op: OpenAPIV3.OperationObject, doc: OpenAPIV3.Document): ParsedSchema | undefined {
  const responses = op.responses ?? {}
  for (const code of ["200", "201", "default"]) {
    const r = responses[code] as OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject | undefined
    if (!r) continue
    const resolved = resolveRef<OpenAPIV3.ResponseObject>(r, doc)
    const json = resolved?.content?.["application/json"]
    if (json?.schema) return parseSchemaObject(json.schema, doc)
  }
  return undefined
}

function parseComponentSchemas(doc: OpenAPIV3.Document): Record<string, ParsedSchema> {
  const out: Record<string, ParsedSchema> = {}
  const schemas = doc.components?.schemas ?? {}
  for (const [name, raw] of Object.entries(schemas)) {
    out[name] = parseSchemaObject(raw, doc, `#/components/schemas/${name}`)
  }
  return out
}

function parseSchemaObject(
  raw: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  doc: OpenAPIV3.Document,
  selfRef?: string,
): ParsedSchema {
  if ("$ref" in raw) {
    const refName = raw.$ref.replace("#/components/schemas/", "")
    const resolved = doc.components?.schemas?.[refName]
    if (resolved && !("$ref" in resolved)) {
      return { ...parseSchemaObject(resolved, doc), ref: raw.$ref }
    }
    return { type: "object", ref: raw.$ref }
  }

  if (raw.type === "array" && raw.items) {
    return { type: "array", items: parseSchemaObject(raw.items, doc), ref: selfRef }
  }

  if (raw.type === "object" || raw.properties) {
    const required = new Set(raw.required ?? [])
    const properties: Record<string, ParsedProperty> = {}
    for (const [propName, propRaw] of Object.entries(raw.properties ?? {})) {
      properties[propName] = parsePropertySchema(propName, propRaw, required.has(propName))
    }
    return { type: "object", properties, ref: selfRef }
  }

  return { type: "primitive", ref: selfRef }
}

function parsePropertySchema(
  name: string,
  raw: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
  required: boolean,
): ParsedProperty {
  if ("$ref" in raw) {
    return { name, type: "object", ref: raw.$ref, required }
  }
  let arrayItemRef: string | undefined
  if (raw.type === "array" && raw.items && "$ref" in raw.items) {
    arrayItemRef = (raw.items as OpenAPIV3.ReferenceObject).$ref
  }
  return {
    name,
    type: typeof raw.type === "string" ? raw.type : "string",
    format: raw.format,
    required,
    description: raw.description,
    enum: raw.enum,
    arrayItemRef,
    minimum: raw.minimum,
    maximum: raw.maximum,
    minLength: raw.minLength,
    maxLength: raw.maxLength,
    pattern: raw.pattern,
  }
}

function resolveRef<T>(value: T | OpenAPIV3.ReferenceObject, doc: OpenAPIV3.Document): T | undefined {
  if (!value || typeof value !== "object") return undefined
  if ("$ref" in value) {
    const ref = (value as OpenAPIV3.ReferenceObject).$ref
    const segments = ref.replace(/^#\//, "").split("/")
    let cursor: unknown = doc
    for (const seg of segments) {
      if (typeof cursor !== "object" || cursor === null) return undefined
      cursor = (cursor as Record<string, unknown>)[seg]
    }
    return cursor as T
  }
  return value as T
}

// ─── clusterEndpoints ──────────────────────────────────────────────────────

/**
 * Group endpoints by their longest non-parameter prefix. `/api/app/orders`,
 * `/api/app/orders/{id}`, and `/api/app/orders/{id}/close` all cluster
 * under the basePath `/api/app/orders` (cluster name `orders`).
 */
export function clusterEndpoints(endpoints: ParsedEndpoint[]): ResourceCluster[] {
  const groups = new Map<string, ParsedEndpoint[]>()
  for (const ep of endpoints) {
    const base = extractClusterBase(ep.path)
    const list = groups.get(base) ?? []
    list.push(ep)
    groups.set(base, list)
  }

  return [...groups.entries()]
    .map(([basePath, eps]) => buildCluster(basePath, eps))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function extractClusterBase(path: string): string {
  const segments = path.split("/").filter(Boolean)
  const out: string[] = []
  for (const seg of segments) {
    if (seg.startsWith("{")) break
    out.push(seg)
  }
  return "/" + out.join("/")
}

type CrudSlot = "list" | "create" | "detail" | "update" | "delete" | null

function classifyEndpoint(ep: ParsedEndpoint, basePath: string): CrudSlot {
  const trailing = ep.path.slice(basePath.length).split("/").filter(Boolean)
  const isBaseOnly = trailing.length === 0
  const looksLikeIdOnly = trailing.length === 1 && trailing[0]!.startsWith("{")

  if (isBaseOnly && ep.method === "GET") return "list"
  if (isBaseOnly && ep.method === "POST") return "create"
  if (looksLikeIdOnly && ep.method === "GET") return "detail"
  if (looksLikeIdOnly && (ep.method === "PUT" || ep.method === "PATCH")) return "update"
  if (looksLikeIdOnly && ep.method === "DELETE") return "delete"
  return null
}

function buildCluster(basePath: string, endpoints: ParsedEndpoint[]): ResourceCluster {
  const cluster: ResourceCluster = {
    name: basePath.split("/").filter(Boolean).pop() ?? basePath,
    basePath,
    customActions: [],
  }
  for (const ep of endpoints) {
    const slot = classifyEndpoint(ep, basePath)
    if (slot && !cluster[slot]) cluster[slot] = ep
    else if (!slot) cluster.customActions.push(ep)
  }
  return cluster
}
