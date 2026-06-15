/**
 * Defense-in-depth helpers for the codegen templates.
 *
 * The Zod schema in `types/builder-schema.ts` already rejects malformed
 * identifiers at the API boundary. These helpers re-assert the same regexes
 * inside the templates so that even if (a) a regex bug slips through, or
 * (b) a future caller bypasses the API and feeds the generator raw input,
 * the templates throw rather than emit attacker-controlled source.
 *
 * Two primitives, two failure modes:
 *
 *   safeIdent(kind, value)    — identifier slot. Throws on mismatch. The
 *                               generator never falls back to writing a
 *                               half-validated identifier.
 *   safeStringLit(value)      — string-literal slot. Returns the JSON.stringify
 *                               form, which is always a syntactically valid
 *                               JS double-quoted string with all unsafe chars
 *                               escaped. A malicious "${alert(1)}" lands as
 *                               the literal `"${alert(1)}"` — no template
 *                               expansion, no quote breakout.
 *
 * The split mirrors the two ways a string can land in generated source:
 *   - bare in code (`function ${pascal}() {}`) → identifier slot
 *   - inside quotes (`super("${endpoint}")`)    → string-literal slot
 *
 * Numbers go through the dedicated `safeNumberLit` so we can reject NaN /
 * Infinity (both are valid TS expressions but rarely intended).
 */

import { IDENT_PATTERNS } from "../types/builder-schema"

export type IdentKind = keyof typeof IDENT_PATTERNS

export class CodegenInjectionError extends Error {
  constructor(
    message: string,
    public readonly kind: IdentKind | "string" | "number",
    public readonly received: unknown,
  ) {
    super(message)
    this.name = "CodegenInjectionError"
  }
}

/**
 * Assert and return an identifier-shaped string. Throws if the value
 * doesn't match the regex registered for `kind`. The error includes the
 * received value so the audit log records what was attempted.
 */
export function safeIdent(kind: IdentKind, value: unknown): string {
  if (typeof value !== "string") {
    throw new CodegenInjectionError(
      `Codegen identifier slot "${kind}" expects a string, got ${typeof value}`,
      kind,
      value,
    )
  }
  if (!IDENT_PATTERNS[kind].test(value)) {
    throw new CodegenInjectionError(
      `Codegen identifier slot "${kind}" rejected "${truncate(value)}" (does not match ${IDENT_PATTERNS[kind]})`,
      kind,
      value,
    )
  }
  return value
}

/**
 * Return a JSON-encoded string literal — i.e. a double-quoted JS expression
 * that is always syntactically valid and always escapes embedded quotes,
 * backslashes, control chars, and non-ASCII. Throws on non-strings rather
 * than coercing — a `null` slipping through means the schema or the
 * generator caller is buggy, and silent coercion would mask that.
 */
export function safeStringLit(value: unknown): string {
  if (typeof value !== "string") {
    throw new CodegenInjectionError(
      `Codegen string-literal slot expects a string, got ${typeof value}`,
      "string",
      value,
    )
  }
  // JSON.stringify gives `"…"` with full escaping. Identical syntax to a
  // JS string literal for our purposes (TS source is a superset of JSON).
  return JSON.stringify(value)
}

/**
 * Inline a number safely. Rejects NaN / +-Infinity (which JSON.stringify
 * would emit as `null`, silently producing wrong code). For finite numbers
 * `String(n)` matches the canonical TS literal form.
 */
export function safeNumberLit(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CodegenInjectionError(
      `Codegen number-literal slot expects a finite number, got ${value}`,
      "number",
      value,
    )
  }
  return String(value)
}

function truncate(s: string): string {
  return s.length > 60 ? `${s.slice(0, 60)}…` : s
}
