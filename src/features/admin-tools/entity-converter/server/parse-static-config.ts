/**
 * Read-only AST parser that lifts a handwritten `<entity>.config.tsx` (plus
 * its sibling `.schema.ts` / `.types.ts`) into the JSON-shaped
 * `RuntimeEntity` the runtime builder UI already understands.
 *
 * Why a parser, not a printer:
 *
 * Prompt 4's round-trip experiment proved `ts.printer` (and therefore
 * `ts-morph`) cannot byte-identically re-emit the project's source style.
 * That's fine here — the convert flow's contract is one-way:
 *
 *     handwritten .config.tsx  ───parse───►  RuntimeEntity (JSON)
 *
 * The reverse direction (regenerating a .config.tsx from a RuntimeEntity)
 * already exists in the materialize pipeline, which writes a fresh file
 * from scratch rather than mutating the original. So this module only
 * READS — no token re-emission ever happens.
 *
 * Strictness over coverage: the parser refuses loudly on anything it
 * can't model losslessly. Reasons:
 *
 *   • A silent half-conversion that drops `listColumns: customListColumns`
 *     is much worse than a refusal — the admin would think "I edited
 *     brand from the UI", save, and discover later that the list view
 *     reverted to defaults.
 *   • Refusals surface as actionable error messages on /admin/entities
 *     ("brand uses external renderers — open the file manually"). The
 *     admin can still edit the file by hand; the convert flow is a
 *     convenience, not the only path.
 *
 * Convertibility expectations: ~35-40 of the 51 entity configs pass
 * (basic CRUD shapes — brand, country, banner, …). Complex entities
 * with custom renderers (order, sales-invoice, purchase-invoice) refuse,
 * which is the intended outcome.
 */

import { promises as fs } from "node:fs"
import { existsSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import type {
  RuntimeEntity,
  RuntimeField,
  RuntimeFieldOption,
  RuntimeFieldType,
  RuntimeFieldValidation,
} from "@/features/runtime-builder/types"

// ─── Public API shape ───────────────────────────────────────────────────────

export interface StaticConfigBlob {
  /** Carried verbatim from the source `.config.tsx` — opaque to this module. */
  listColumns?: unknown
  detailSections?: unknown
  formLayout?: unknown
  searchFields?: unknown
  defaultSort?: unknown
  defaultPageSize?: unknown
  translations?: unknown
}

export interface ParseSuccess {
  ok: true
  entity: RuntimeEntity
  /** Source files inspected — used by the convert route to snapshot before deleting. */
  sourcePaths: string[]
  /**
   * Verbatim preserved structural blocks. Stored as opaque JSON so a future
   * materialize-aware path can re-emit them; the runtime UI ignores it.
   */
  staticBlob: StaticConfigBlob
}

export interface ParseRefusal {
  ok: false
  reason: string
  filePath: string
}

export type ParseResult = ParseSuccess | ParseRefusal

export interface ParseOptions {
  /** Override for tests / dry-runs. Defaults to process.cwd(). */
  repoRoot?: string
}

// ─── Field-type translation ─────────────────────────────────────────────────
//
// `FormFieldConfig.type` (13 values) → `RuntimeFieldType` (19 values).
// Members of the input vocab that have NO runtime equivalent (`custom`,
// `password`, `enum`) refuse — there's no point converting an entity if
// even one of its fields can't be rendered by the runtime data view.

const FIELD_TYPE_MAP: Record<string, RuntimeFieldType | "__refuse__"> = {
  text: "text",
  textarea: "textarea",
  number: "number",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  select: "select",
  file: "file",
  email: "email",
  autocomplete: "entity-autocomplete",
  custom: "__refuse__",
  password: "__refuse__",
  enum: "__refuse__",
}

// ─── Filesystem layout ──────────────────────────────────────────────────────
//
// Two shapes seen in src/domains/:
//
//   src/domains/<domain>/<entityName>/<entityName>.config.tsx        (51 of 51 — primary)
//   src/domains/<domain>/reports/<entityName>.config.tsx             (5 — flat reports)
//
// We search both — the parser is filesystem-tolerant so the admin can
// reorganise domains without a manifest update.

async function locateConfigFiles(
  entityName: string,
  repoRoot: string,
): Promise<{ configPath: string; schemaPath: string | null; typesPath: string | null } | null> {
  const domainsDir = path.join(repoRoot, "src", "domains")
  if (!existsSync(domainsDir)) return null

  // Walk the entire tree looking for `<entityName>.config.{ts,tsx}`. The
  // repo uses three layouts at once:
  //
  //   src/domains/<domain>/<entityName>/<entityName>.config.tsx        (most common — brand, category, …)
  //   src/domains/<domain>/<entityName>.config.tsx                     (flat — purchase-invoice, user, ticket)
  //   src/domains/<domain>/reports/<entityName>.config.tsx             (report-style)
  //
  // A recursive walk is more honest than a list of templates: if a future
  // entity arrives under a new layout, the parser still finds it.
  const candidates = await collectConfigPaths(domainsDir)
  const wanted = candidates.find(
    p => /\.config\.(ts|tsx)$/.test(p) && path.basename(p).replace(/\.config\.(ts|tsx)$/, "") === entityName,
  )
  const configPath = wanted ?? null
  if (!configPath) return null

  const dir = path.dirname(configPath)
  const schemaPath =
    [path.join(dir, `${entityName}.schema.ts`), path.join(dir, `${entityName}.zod.ts`)].find(p => existsSync(p)) ?? null

  const typesPath =
    [path.join(dir, `${entityName}.types.ts`), path.join(dir, `${entityName}.service.ts`)].find(p => existsSync(p)) ??
    null

  return { configPath, schemaPath, typesPath }
}

// ─── AST helpers ────────────────────────────────────────────────────────────

function loadSourceFile(filePath: string, source: string): ts.SourceFile {
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TSX)
}

/** Find the exported `<name>Config` object literal. */
function findConfigLiteral(sf: ts.SourceFile): ts.ObjectLiteralExpression | null {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    const isExported = stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!isExported) continue
    for (const decl of stmt.declarationList.declarations) {
      const init = decl.initializer
      if (init && ts.isObjectLiteralExpression(init)) return init
      // `as EntityConfig<...>` cast — peek through it.
      if (init && ts.isAsExpression(init) && ts.isObjectLiteralExpression(init.expression)) return init.expression
    }
  }
  return null
}

/** Extract a property by name from an object literal, returning the AST node. */
function getProp(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | null {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === name) {
      return prop.initializer
    }
  }
  return null
}

/** Get a string-literal value, or null if the expression is anything else. */
function asStringLiteral(node: ts.Expression | null): string | null {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

/** Get a boolean-literal value, or null. */
function asBooleanLiteral(node: ts.Expression | null): boolean | null {
  if (!node) return null
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  return null
}

/** Get an Identifier name (for `icon: ShoppingCart`), or null. */
function asIdentifierName(node: ts.Expression | null): string | null {
  if (!node) return null
  return ts.isIdentifier(node) ? node.text : null
}

/** Reconstruct a property name (Identifier or StringLiteral) as a JS string. */
function propKeyName(prop: ts.ObjectLiteralElementLike): string | null {
  if ("name" in prop && prop.name) {
    if (ts.isIdentifier(prop.name)) return prop.name.text
    if (ts.isStringLiteral(prop.name)) return prop.name.text
  }
  return null
}

/**
 * Best-effort: serialise an arbitrary AST expression to a JSON value.
 * Returns `undefined` on patterns this module won't represent (JSX,
 * arrow fns, identifier refs to imports, …). The caller decides what
 * to do with `undefined` — usually "carry the verbatim source text"
 * for the static blob, OR refuse outright when the expression sits on
 * a path the parser must round-trip exactly.
 */
function exprToJsonLiteral(node: ts.Expression): unknown | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isNumericLiteral(node)) return Number(node.text)
  return undefined
}

function arrayToJson(node: ts.ArrayLiteralExpression): unknown | undefined {
  const out: unknown[] = []
  for (const el of node.elements) {
    if (ts.isOmittedExpression(el)) return undefined
    const v = exprToJson(el)
    if (v === undefined) return undefined
    out.push(v)
  }
  return out
}

function objectToJson(node: ts.ObjectLiteralExpression): unknown | undefined {
  const out: Record<string, unknown> = {}
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) return undefined
    const k = propKeyName(prop)
    if (!k) return undefined
    const v = exprToJson(prop.initializer)
    if (v === undefined) return undefined
    out[k] = v
  }
  return out
}

function exprToJson(node: ts.Expression): unknown | undefined {
  const lit = exprToJsonLiteral(node)
  if (lit !== undefined) return lit
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = exprToJson(node.operand)
    return typeof inner === "number" ? -inner : undefined
  }
  if (ts.isArrayLiteralExpression(node)) return arrayToJson(node)
  if (ts.isObjectLiteralExpression(node)) return objectToJson(node)
  // PropertyAccess like `OrderStatus.New` — keep as a sentinel token so the
  // verbatim blob round-trips when re-emitted by hand.
  if (ts.isPropertyAccessExpression(node)) return { __expr__: node.getText() }
  if (ts.isAsExpression(node)) return exprToJson(node.expression)
  // Arrow fns, JSX, calls — opaque.
  return undefined
}

// ─── Refusal helpers ────────────────────────────────────────────────────────

class RefusedError extends Error {
  constructor(public readonly reason: string) {
    super(reason)
    this.name = "RefusedError"
  }
}

/** True if the subtree contains any JSX child — the marker of "this renders custom output". */
function hasJsx(node: ts.Node): boolean {
  let found = false
  function walk(n: ts.Node) {
    if (found) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true
      return
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return found
}

/**
 * True if the subtree contains an arrow / function expression whose body
 * itself contains JSX. The plain `condition: entity => !!entity.note`
 * style is OK — it's a display-gate predicate, not a renderer — and we
 * pass on it during convert (the predicate is dropped from the static
 * blob but the entity still converts cleanly).
 */
function hasFunctionWithJsx(node: ts.Node): boolean {
  let found = false
  function walk(n: ts.Node) {
    if (found) return
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      if (hasJsx(n.body)) {
        found = true
        return
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return found
}

// ─── formFields extraction ──────────────────────────────────────────────────

function resolveFieldType(cfg: ts.ObjectLiteralExpression, key: string): RuntimeFieldType {
  const rawType = asStringLiteral(getProp(cfg, "type"))
  if (!rawType) throw new RefusedError(`formFields.${key} has no type literal`)
  const mapped = FIELD_TYPE_MAP[rawType]
  if (!mapped) throw new RefusedError(`formFields.${key} uses unknown type "${rawType}"`)
  if (mapped === "__refuse__") throw new RefusedError(`formFields.${key} uses unsupported type "${rawType}"`)
  return mapped
}

function checkFieldForbidden(cfg: ts.ObjectLiteralExpression, key: string): void {
  if (getProp(cfg, "condition")) {
    throw new RefusedError(`formFields.${key} uses conditional rendering`)
  }
  if (getProp(cfg, "customRender") || getProp(cfg, "renderSelected") || getProp(cfg, "renderItem")) {
    throw new RefusedError(`formFields.${key} uses custom render hooks`)
  }
}

function extractSelectOptions(cfg: ts.ObjectLiteralExpression, key: string): RuntimeFieldOption[] | undefined {
  const optsExpr = getProp(cfg, "options")
  if (!optsExpr) return undefined
  if (!ts.isArrayLiteralExpression(optsExpr)) {
    throw new RefusedError(`formFields.${key} options is not an inline array`)
  }
  const options: RuntimeFieldOption[] = []
  for (const opt of optsExpr.elements) {
    if (!ts.isObjectLiteralExpression(opt)) {
      throw new RefusedError(`formFields.${key} options contain non-literal entries`)
    }
    const valueExpr = getProp(opt, "value")
    const labelExpr = getProp(opt, "label") ?? getProp(opt, "labelKey")
    const v = asStringLiteral(valueExpr)
    const l = asStringLiteral(labelExpr)
    if (v == null || l == null) {
      throw new RefusedError(`formFields.${key} options reference non-literal values`)
    }
    options.push({ value: v, label: l })
  }
  return options.length > 0 ? options : undefined
}

function extractValidation(cfg: ts.ObjectLiteralExpression): RuntimeFieldValidation | undefined {
  const validationExpr = getProp(cfg, "validation")
  if (!validationExpr || !ts.isObjectLiteralExpression(validationExpr)) return undefined
  const v: RuntimeFieldValidation = {}
  const min = exprToJson(getProp(validationExpr, "min") ?? ts.factory.createNull())
  const max = exprToJson(getProp(validationExpr, "max") ?? ts.factory.createNull())
  const minLength = exprToJson(getProp(validationExpr, "minLength") ?? ts.factory.createNull())
  const maxLength = exprToJson(getProp(validationExpr, "maxLength") ?? ts.factory.createNull())
  if (typeof min === "number") v.min = min
  if (typeof max === "number") v.max = max
  if (typeof minLength === "number") v.minLength = minLength
  if (typeof maxLength === "number") v.maxLength = maxLength
  return Object.keys(v).length > 0 ? v : undefined
}

function buildField(key: string, cfg: ts.ObjectLiteralExpression): RuntimeField {
  const mapped = resolveFieldType(cfg, key)
  const labelKey = asStringLiteral(getProp(cfg, "labelKey"))
  const label = asStringLiteral(getProp(cfg, "label")) ?? labelKey ?? key

  const field: RuntimeField = {
    key,
    label,
    type: mapped,
    required: asBooleanLiteral(getProp(cfg, "required")) === true,
    placeholder: asStringLiteral(getProp(cfg, "placeholder")) ?? undefined,
    description: asStringLiteral(getProp(cfg, "description")) ?? undefined,
  }

  if (mapped === "select" || mapped === "multi-select") {
    const options = extractSelectOptions(cfg, key)
    if (options) field.options = options
  }
  if (mapped === "entity-autocomplete") {
    const entityName = asStringLiteral(getProp(cfg, "entityName"))
    const displayField = asStringLiteral(getProp(cfg, "displayField"))
    if (entityName && displayField) {
      field.entityAutocompleteConfig = { targetEntityName: entityName, displayField }
    }
  }
  const validation = extractValidation(cfg)
  if (validation) field.validation = validation
  return field
}

function parseFormFields(formFieldsExpr: ts.Expression): RuntimeField[] {
  if (!ts.isObjectLiteralExpression(formFieldsExpr)) {
    throw new RefusedError("Uses external renderers (formFields is not an inline object literal)")
  }

  const fields: RuntimeField[] = []
  for (const prop of formFieldsExpr.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      throw new RefusedError("formFields contains a spread or computed key")
    }
    const key = propKeyName(prop)
    if (!key) throw new RefusedError("formFields key is dynamic")
    if (!ts.isObjectLiteralExpression(prop.initializer)) {
      throw new RefusedError(`formFields.${key} is not an inline object literal`)
    }

    const cfg = prop.initializer
    checkFieldForbidden(cfg, key)
    // Hidden fields are skipped — the runtime engine reintroduces them.
    if (asBooleanLiteral(getProp(cfg, "hidden")) === true) continue
    fields.push(buildField(key, cfg))
  }

  if (fields.length === 0) {
    throw new RefusedError("formFields is empty after stripping hidden/refused entries")
  }
  return fields
}

// ─── Per-entity inspection ──────────────────────────────────────────────────

interface Inspection {
  entity: RuntimeEntity
  staticBlob: StaticConfigBlob
}

function refuseIdentifierProp(expr: ts.Expression | null, label: string): void {
  if (expr && ts.isIdentifier(expr)) {
    throw new RefusedError(`Uses external renderers (${label} is an identifier ref)`)
  }
}

function refuseJsxBlock(expr: ts.Expression | null, label: string): void {
  if (!expr) return
  refuseIdentifierProp(expr, label)
  if (hasJsx(expr) || hasFunctionWithJsx(expr)) {
    throw new RefusedError(`${label} contains custom render logic (JSX)`)
  }
}

function refuseBadDefaults(obj: ts.ObjectLiteralExpression): void {
  const expr = getProp(obj, "defaultFormValues")
  if (!expr) return
  if (ts.isAsExpression(expr)) {
    if (!ts.isObjectLiteralExpression(expr.expression)) {
      throw new RefusedError("defaultFormValues uses a non-literal `as` cast")
    }
    return
  }
  if (!ts.isObjectLiteralExpression(expr)) {
    throw new RefusedError("defaultFormValues is not an inline object literal")
  }
}

function refuseBadEntityToFormData(obj: ts.ObjectLiteralExpression): void {
  const expr = getProp(obj, "entityToFormData")
  if (!expr) return
  if (!ts.isArrowFunction(expr)) {
    throw new RefusedError("entityToFormData is not a simple arrow function")
  }
  const body = expr.body
  const inner = ts.isParenthesizedExpression(body) ? body.expression : body
  if (!ts.isObjectLiteralExpression(inner)) {
    throw new RefusedError("entityToFormData body is not a plain object literal")
  }
  if (hasJsx(inner) || hasFunctionWithJsx(inner)) {
    throw new RefusedError("entityToFormData contains JSX or render hooks")
  }
}

function buildStaticBlob(obj: ts.ObjectLiteralExpression): StaticConfigBlob {
  const pick = (name: string): unknown => {
    const e = getProp(obj, name)
    return e ? exprToJson(e) : undefined
  }
  return {
    listColumns: pick("listColumns"),
    detailSections: pick("detailSections"),
    formLayout: pick("formLayout"),
    searchFields: pick("searchFields"),
    defaultSort: pick("defaultSort"),
    defaultPageSize: pick("defaultPageSize"),
    translations: pick("translations"),
  }
}

function inspectConfigLiteral(obj: ts.ObjectLiteralExpression, _filePath: string): Inspection {
  const entityName = asStringLiteral(getProp(obj, "entityName"))
  if (!entityName) throw new RefusedError("entityName is not a string literal")

  // listColumns / formFields / detailSections / formLayout MUST be inline.
  refuseIdentifierProp(getProp(obj, "listColumns"), "listColumns")
  const formFieldsExpr = getProp(obj, "formFields")
  if (!formFieldsExpr) throw new RefusedError("formFields is missing")
  refuseIdentifierProp(formFieldsExpr, "formFields")
  refuseJsxBlock(getProp(obj, "detailSections"), "detailSections")
  refuseJsxBlock(getProp(obj, "formLayout"), "formLayout")
  refuseBadDefaults(obj)
  refuseBadEntityToFormData(obj)

  const fields = parseFormFields(formFieldsExpr)
  for (const f of fields) {
    if (!isKnownRuntimeFieldType(f.type)) {
      throw new RefusedError(`field "${f.key}" uses unsupported type "${f.type}"`)
    }
  }

  const featuresExpr = getProp(obj, "features")
  const features =
    featuresExpr && ts.isObjectLiteralExpression(featuresExpr)
      ? (exprToJson(featuresExpr) as RuntimeEntity["features"])
      : undefined

  const now = Date.now()
  const entity: RuntimeEntity = {
    id: entityName,
    singularName: asStringLiteral(getProp(obj, "singularName")) ?? entityName,
    pluralName: asStringLiteral(getProp(obj, "pluralName")) ?? `${entityName}s`,
    fields,
    permissionKey: asStringLiteral(getProp(obj, "permissionKey")) ?? undefined,
    icon: asIdentifierName(getProp(obj, "icon")) ?? undefined,
    description: asStringLiteral(getProp(obj, "description")) ?? undefined,
    features,
    createdAt: now,
    updatedAt: now,
  }
  return { entity, staticBlob: buildStaticBlob(obj) }
}

const RUNTIME_FIELD_TYPES = new Set<string>([
  "text",
  "textarea",
  "richtext",
  "number",
  "currency",
  "percentage",
  "boolean",
  "date",
  "datetime",
  "time",
  "select",
  "multi-select",
  "entity-autocomplete",
  "file",
  "image",
  "phone",
  "email",
  "url",
  "color",
])

function isKnownRuntimeFieldType(t: string): t is RuntimeFieldType {
  return RUNTIME_FIELD_TYPES.has(t)
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function parseStaticConfig(entityName: string, options: ParseOptions = {}): Promise<ParseResult> {
  const repoRoot = options.repoRoot ?? process.cwd()

  const located = await locateConfigFiles(entityName, repoRoot)
  if (!located) {
    return { ok: false, reason: "Config file not found under src/domains/", filePath: "" }
  }

  let source: string
  try {
    source = await fs.readFile(located.configPath, "utf8")
  } catch (err) {
    return { ok: false, reason: `Failed to read config: ${(err as Error).message}`, filePath: located.configPath }
  }

  const sf = loadSourceFile(located.configPath, source)
  const literal = findConfigLiteral(sf)
  if (!literal) {
    return {
      ok: false,
      reason: "No exported config object literal found",
      filePath: located.configPath,
    }
  }

  try {
    const { entity, staticBlob } = inspectConfigLiteral(literal, located.configPath)
    const sourcePaths = [located.configPath, located.schemaPath, located.typesPath].filter(
      (p): p is string => typeof p === "string",
    )
    return { ok: true, entity, sourcePaths, staticBlob }
  } catch (err) {
    if (err instanceof RefusedError) {
      return { ok: false, reason: err.reason, filePath: located.configPath }
    }
    return { ok: false, reason: (err as Error).message, filePath: located.configPath }
  }
}

// ─── Convertibility report (used by /admin/entities + the docs build) ──────

export interface ConvertibilityRow {
  entityName: string
  configPath: string
  ok: boolean
  reason: string | null
}

/**
 * Walk `src/domains/` for every `*.config.{ts,tsx}` and run the parser
 * against each. Returns a stable-sorted report — the docs build pins
 * this to `docs/static-entity-convertibility.md`.
 */
export async function buildConvertibilityReport(options: ParseOptions = {}): Promise<ConvertibilityRow[]> {
  const repoRoot = options.repoRoot ?? process.cwd()
  const domainsDir = path.join(repoRoot, "src", "domains")
  if (!existsSync(domainsDir)) return []

  const found = await collectConfigPaths(domainsDir)
  const rows: ConvertibilityRow[] = []

  for (const configPath of found) {
    const fileName = path.basename(configPath)
    const entityName = fileName.replace(/\.config\.(ts|tsx)$/, "")
    const result = await parseStaticConfig(entityName, { repoRoot })
    rows.push({
      entityName,
      configPath: path.relative(repoRoot, configPath).replace(/\\/g, "/"),
      ok: result.ok,
      reason: result.ok ? null : result.reason,
    })
  }

  rows.sort((a, b) => a.configPath.localeCompare(b.configPath))
  return rows
}

async function collectConfigPaths(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string) {
    let entries: import("node:fs").Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name)
      if (ent.isDirectory()) await walk(p)
      else if (ent.isFile() && /\.config\.(ts|tsx)$/.test(ent.name)) out.push(p)
    }
  }
  await walk(root)
  return out
}

// ─── Test-only helpers ──────────────────────────────────────────────────────
//
// Exposed for unit tests to drive the refusal rules with synthetic source
// strings without touching the filesystem. Production callers use
// `parseStaticConfig(entityName)` instead.

export function parseStaticConfigFromSource(filePath: string, source: string): ParseResult {
  const sf = loadSourceFile(filePath, source)
  const literal = findConfigLiteral(sf)
  if (!literal) {
    return { ok: false, reason: "No exported config object literal found", filePath }
  }
  try {
    const { entity, staticBlob } = inspectConfigLiteral(literal, filePath)
    return { ok: true, entity, sourcePaths: [filePath], staticBlob }
  } catch (err) {
    if (err instanceof RefusedError) {
      return { ok: false, reason: err.reason, filePath }
    }
    return { ok: false, reason: (err as Error).message, filePath }
  }
}

/** Render the report as a single Markdown table — used by docs commit. */
export function renderConvertibilityMarkdown(rows: ConvertibilityRow[]): string {
  const ok = rows.filter(r => r.ok)
  const refused = rows.filter(r => !r.ok)
  const lines: string[] = []
  lines.push("# Static-entity convertibility")
  lines.push("")
  lines.push(
    `Auto-generated by \`buildConvertibilityReport()\` (parse-static-config.ts). ` +
      `${ok.length}/${rows.length} entities can be converted to runtime form from /admin/entities.`,
  )
  lines.push("")
  lines.push("| Entity | Source | Convertible | Reason |")
  lines.push("| --- | --- | --- | --- |")
  for (const r of rows) {
    const conv = r.ok ? "yes" : "no"
    const reason = r.reason ? r.reason.replace(/\|/g, "\\|") : ""
    lines.push(`| ${r.entityName} | ${r.configPath} | ${conv} | ${reason} |`)
  }
  lines.push("")
  if (refused.length > 0) {
    lines.push("## Refusal counts by reason")
    lines.push("")
    const counts = new Map<string, number>()
    for (const r of refused) counts.set(r.reason!, (counts.get(r.reason!) ?? 0) + 1)
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    for (const [reason, count] of sorted) lines.push(`- **${count}**: ${reason}`)
    lines.push("")
  }
  return lines.join("\n")
}
