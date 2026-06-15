/**
 * Best-effort error → string extraction for arbitrary thrown values.
 *
 * Lives in `shared/` (not `infra/api`) because UI surfaces — forms, toast
 * helpers — need to format errors from any source (RHF, zod, JS), not just
 * axios. The HTTP-aware error *classes* (`AppError`, `ValidationError`, etc.)
 * stay in `@/infra/api/errors` since they encode statusCode/correlationId
 * shape from the API client.
 */

function extractArrayMessage(parsed: unknown[]): string | null {
  const first = parsed[0]
  if (first && typeof first === "object" && (first as Record<string, unknown>).message) {
    return String((first as Record<string, unknown>).message)
  }
  if (typeof first === "string") return first
  return null
}

function extractParsedObjectMessage(parsed: Record<string, unknown>): string | null {
  if (parsed.message) return String(parsed.message)
  if (parsed.error && typeof parsed.error === "object") {
    const errorObj = parsed.error as Record<string, unknown>
    if (errorObj.message) return String(errorObj.message)
  }
  return null
}

function tryParseJsonMessage(str: string): string | null {
  if (!str || typeof str !== "string") return null
  const trimmed = str.trim()
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return extractArrayMessage(parsed)
    if (parsed && typeof parsed === "object") {
      return extractParsedObjectMessage(parsed as Record<string, unknown>)
    }
  } catch {
    return null
  }
  return null
}

function extractObjectMessage(error: object): string | null {
  const obj = error as Record<string, unknown>
  if (typeof obj.message === "string") {
    return tryParseJsonMessage(obj.message) || obj.message
  }
  if (obj.error && typeof obj.error === "object") {
    const nested = obj.error as Record<string, unknown>
    if (typeof nested.message === "string") {
      return tryParseJsonMessage(nested.message) || nested.message
    }
  }
  return null
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return tryParseJsonMessage(error) || error
  }
  if (error instanceof Error) {
    return tryParseJsonMessage(error.message) || error.message
  }
  if (error && typeof error === "object") {
    return extractObjectMessage(error) || "An unknown error occurred"
  }
  return "An unknown error occurred"
}

/** The user-facing message + secondary detail extracted from an API error. */
export interface ApiErrorParts {
  /** Primary message (ABP `error.message`), if the response carried one. */
  message?: string
  /** Secondary detail: ABP `error.details`, else the joined validation messages. */
  detail?: string
}

/**
 * Collect non-blank messages out of an error collection, supporting every
 * common shape:
 *  - an array of strings: `["A", "B"]`
 *  - an array of objects: `[{ message }, ...]` (ABP `validationErrors`)
 *  - a field-keyed map: `{ field: "msg" | ["msg", ...] }` (ASP.NET ModelState)
 */
function collectMessages(val: unknown): string[] {
  if (!val || typeof val !== "object") return []
  const raw = Array.isArray(val)
    ? val.map(v => (v && typeof v === "object" ? (v as Record<string, unknown>).message : v))
    : Object.values(val as Record<string, unknown>).flatMap(v => (Array.isArray(v) ? v : [v]))
  return raw.filter((m): m is string => typeof m === "string" && m.trim().length > 0).map(m => m.trim())
}

/**
 * Pull the message + detail out of an API error payload (or an `AppError`'s
 * `details`). Handles every shape the ABP backend may return:
 *  - ABP envelope `{ error: { code, message, details, validationErrors:
 *    [{ message, members }] } }` — or that inner `error` object passed directly
 *  - a generic `{ message, errors }` payload, where `errors` is an array of
 *    strings/objects or a field-keyed ModelState map
 *
 * The server's human-readable `details` string is preferred; otherwise the
 * detail is the de-duped, joined set of `validationErrors` + `errors` messages.
 * Returns `{}` when nothing usable is present, so callers can apply their own
 * default (a localized fallback).
 */
export function extractApiErrorParts(raw: unknown): ApiErrorParts {
  if (!raw || typeof raw !== "object") return {}
  const top = raw as Record<string, unknown>
  const e = (top.error && typeof top.error === "object" ? top.error : top) as Record<string, unknown>

  const message = typeof e.message === "string" && e.message.trim() ? e.message.trim() : undefined

  let detail: string | undefined
  // The server's own human-readable details string wins when present.
  if (typeof e.details === "string" && e.details.trim()) detail = e.details.trim()
  // Otherwise synthesize one from any validation/error collection on the payload.
  if (!detail) {
    const messages = [...new Set([...collectMessages(e.validationErrors), ...collectMessages(e.errors)])]
    if (messages.length) detail = messages.join(" · ")
  }
  return { message, detail }
}
