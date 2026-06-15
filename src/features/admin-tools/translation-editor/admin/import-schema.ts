import { z } from "zod"

/**
 * Two accepted import shapes:
 *
 *   FLAT     { locale, overrides: { "<ns>.<keyPath>": value } }
 *            — the original export format, routed through /api/i18n/overrides.
 *
 *   SOURCE   { locale, namespace, source: <deep nested JSON> }
 *            — a slice of messages/<locale>/<namespace>.json, routed through
 *              /api/i18n/source-write (only allowed when SOURCE_WRITE_ENABLED).
 *
 * Both schemas are `.strict()` so a payload mixing the two ({ locale,
 * overrides, source }) fails BOTH branches and falls through to a clear
 * "invalid" error rather than silently picking one shape.
 */

const FlatImportSchema = z
  .object({
    locale: z.enum(["en", "ar"]),
    overrides: z.record(z.string(), z.string()),
  })
  .strict()

const SourceImportSchema = z
  .object({
    locale: z.enum(["en", "ar"]),
    namespace: z.string().min(1, "namespace must be non-empty"),
    // Generic JSON object — the flattener walks it; strict per-leaf validation
    // happens in flattenSource so the error message can point at the offender.
    source: z.record(z.string(), z.unknown()),
  })
  .strict()

export interface DiffRow {
  flatKey: string
  oldValue: string | undefined
  newValue: string | undefined
  status: "added" | "changed" | "removed" | "unchanged"
}

/**
 * Compare an imported override map against the current one. Used to power
 * the 3-column preview before the admin confirms.
 */
export function diffOverrides(current: Record<string, string>, incoming: Record<string, string>): DiffRow[] {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(incoming)])
  const rows: DiffRow[] = []
  for (const key of allKeys) {
    const oldValue = current[key]
    const newValue = incoming[key]
    let status: DiffRow["status"]
    if (oldValue === undefined && newValue !== undefined) status = "added"
    else if (oldValue !== undefined && newValue === undefined) status = "removed"
    else if (oldValue !== newValue) status = "changed"
    else status = "unchanged"
    rows.push({ flatKey: key, oldValue, newValue, status })
  }
  // Show changes first, unchanged last
  const order: Record<DiffRow["status"], number> = { changed: 0, added: 1, removed: 2, unchanged: 3 }
  rows.sort((a, b) => order[a.status] - order[b.status] || a.flatKey.localeCompare(b.flatKey))
  return rows
}

/**
 * Split a flatKey "<namespace>.<keyPath>" into the two parts the PATCH
 * endpoint expects. Top-level (no namespace) keys round-trip as namespace="".
 */
export function splitFlatKey(flatKey: string): { namespace: string; keyPath: string } {
  const dot = flatKey.indexOf(".")
  if (dot <= 0) return { namespace: "", keyPath: flatKey }
  return { namespace: flatKey.slice(0, dot), keyPath: flatKey.slice(dot + 1) }
}

// ─── Source-shape flattener + dispatcher ─────────────────────────────────────

export interface FlattenedSourceEntry {
  keyPath: string
  value: string
}

export class FlattenSourceError extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: string,
  ) {
    super(`Source value at "${path}" is invalid: ${reason}`)
    this.name = "FlattenSourceError"
  }
}

/**
 * Walk a deep JSON object and emit one entry per string leaf, with `keyPath`
 * built from dotted parent keys. Empty objects are silently skipped (no
 * keyPath to emit). Non-string leaves throw — translation values must be
 * strings, and surfacing the offender's path is more helpful than a server
 * 400 buried per-key.
 */
export function flattenSource(source: Record<string, unknown>, prefix = ""): FlattenedSourceEntry[] {
  const out: FlattenedSourceEntry[] = []
  for (const [key, value] of Object.entries(source)) {
    const here = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") {
      out.push({ keyPath: here, value })
      continue
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.push(...flattenSource(value as Record<string, unknown>, here))
      continue
    }
    if (value === null) throw new FlattenSourceError(here, "null is not a translation value")
    if (Array.isArray(value)) throw new FlattenSourceError(here, "arrays are not allowed in messages")
    throw new FlattenSourceError(here, `${typeof value} is not a translation value`)
  }
  return out
}

export type InterpretResult =
  | { kind: "flat"; locale: "en" | "ar"; overrides: Record<string, string> }
  | { kind: "source"; locale: "en" | "ar"; namespace: string; flattened: FlattenedSourceEntry[] }
  | { kind: "error"; error: string }

interface InterpretOptions {
  sourceWriteEnabled: boolean
}

/**
 * Detect which shape a parsed import payload uses, validate it, and (for
 * source shape) flatten it. A single entry point keeps the dialog UI free
 * of branch logic — the dialog reads `result.kind` and dispatches.
 *
 * Source-shape is refused when source-write isn't armed on this build —
 * importing into the source files behind a closed gate makes no sense and
 * would just produce a server-side 404 per write.
 */
export function interpretImport(raw: unknown, opts: InterpretOptions): InterpretResult {
  const flat = FlatImportSchema.safeParse(raw)
  if (flat.success) {
    return { kind: "flat", locale: flat.data.locale, overrides: flat.data.overrides }
  }

  const source = SourceImportSchema.safeParse(raw)
  if (source.success) {
    if (!opts.sourceWriteEnabled) {
      return {
        kind: "error",
        error:
          "Source-shape imports require source-write mode. " +
          "Set NEXT_PUBLIC_APP_ALLOW_RUNTIME_CODEGEN=true or upload a flat overrides export.",
      }
    }
    try {
      const flattened = flattenSource(source.data.source)
      return { kind: "source", locale: source.data.locale, namespace: source.data.namespace, flattened }
    } catch (err) {
      return { kind: "error", error: err instanceof Error ? err.message : "Failed to flatten source object" }
    }
  }

  return {
    kind: "error",
    error:
      "Invalid import file. Expected either a flat overrides export ({ locale, overrides }) " +
      "or a source-shape slice ({ locale, namespace, source }). Mixed or extra fields are rejected.",
  }
}

/**
 * Treat a RAW messages file — `messages/<locale>/<namespace>.json`, i.e. just
 * `{ key: {…nested…} }` with no `locale`/`namespace`/`overrides`/`source`
 * envelope — as a source slice. Such a file matches neither import schema, so
 * `interpretImport` rejects it; the dialog falls back here when it can derive
 * the namespace from the filename and the locale from the current view.
 *
 * Validates `raw` is a plain (non-array, non-null) object, then reuses
 * `flattenSource` so the leaf-validation rules are identical to source-shape
 * imports. The caller is responsible for gating this behind SOURCE_WRITE_ENABLED
 * — a raw-file import ultimately routes through /api/i18n/source-write.
 */
export function interpretRawNamespace(raw: unknown, locale: "en" | "ar", namespace: string): InterpretResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { kind: "error", error: "Raw namespace file must be a JSON object of translation keys." }
  }
  if (namespace.trim() === "") {
    return { kind: "error", error: "Could not infer a namespace from the file name." }
  }
  try {
    const flattened = flattenSource(raw as Record<string, unknown>)
    return { kind: "source", locale, namespace, flattened }
  } catch (err) {
    return { kind: "error", error: err instanceof Error ? err.message : "Failed to flatten raw namespace file" }
  }
}
