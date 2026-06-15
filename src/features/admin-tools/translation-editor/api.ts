/**
 * Thin client for the i18n editor routes.
 *
 * Two write paths exist behind the same UI:
 *   - overrides:    /api/i18n/overrides         (default, no flag required)
 *   - source-write: /api/i18n/source-write      (gated, edits source files)
 *
 * The UI picks one based on `SOURCE_WRITE_ENABLED` (see ./lib/write-mode).
 * Both flavours expose a normalised `MutationResponse` shape so the
 * downstream save handler doesn't branch on which endpoint it called.
 */

import { API_ROUTES } from "@/shared/api/routes"

/** Carries the HTTP status so callers can branch (e.g. Import on a 409 parity refusal). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

/** Pull the most useful message out of an error response body (JSON {message|error} or raw text). */
async function readError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const json = JSON.parse(text) as { message?: string; error?: string }
    return json.message ?? json.error ?? text
  } catch {
    return text
  }
}

export interface MutationResponse {
  locale: string
  key: string
  value?: string
  version: number
  overrides: Record<string, string>
}

interface FetchResponse {
  locale: string
  overrides: Record<string, string>
}

interface SourceMutationResponse {
  locale: string
  namespace: string
  keyPath: string
  value?: string
  version: number
  source: Record<string, unknown>
}

function splitFlat(namespace: string, keyPath: string): string {
  return namespace ? `${namespace}.${keyPath}` : keyPath
}

export async function fetchOverrides(locale: string): Promise<Record<string, string>> {
  const res = await fetch(`${API_ROUTES.i18n.overrides}?locale=${encodeURIComponent(locale)}`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Failed to fetch overrides (${res.status})`)
  const data = (await res.json()) as FetchResponse
  return data.overrides
}

/**
 * Read the FULL nested namespace JSON from the source files. Used by the
 * "All translations" browser to show/edit the ~2882 base keys, not just the
 * overrides. GET /api/i18n/source-write?locale=&namespace= returns
 * `{ locale, namespace, source }`; we return the nested `source` object and
 * let the caller flatten it. The endpoint is gated behind source-write mode
 * (404 when the gate is closed), so callers should check SOURCE_WRITE_ENABLED.
 */
export async function fetchSource(locale: string, namespace: string): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${API_ROUTES.i18n.sourceWrite}?locale=${encodeURIComponent(locale)}&namespace=${encodeURIComponent(namespace)}`,
    { cache: "no-store" },
  )
  if (!res.ok) throw new HttpError(res.status, await readError(res))
  const data = (await res.json()) as { locale: string; namespace: string; source: Record<string, unknown> }
  return data.source
}

export async function patchOverride(
  locale: string,
  namespace: string,
  keyPath: string,
  value: string,
): Promise<MutationResponse> {
  const res = await fetch(API_ROUTES.i18n.overrides, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, namespace, keyPath, value }),
  })
  if (!res.ok) throw new Error(`PATCH failed (${res.status}): ${await res.text()}`)
  return (await res.json()) as MutationResponse
}

export async function deleteOverride(locale: string, namespace: string, keyPath: string): Promise<MutationResponse> {
  const res = await fetch(API_ROUTES.i18n.overrides, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, namespace, keyPath }),
  })
  if (!res.ok) throw new Error(`DELETE failed (${res.status}): ${await res.text()}`)
  return (await res.json()) as MutationResponse
}

/**
 * Source-write variant. Speaks to /api/i18n/source-write and adapts its
 * response into the same `MutationResponse` shape the override variant
 * returns. The `overrides` map is intentionally left empty: in source-write
 * mode there is no parallel overrides store, so the editor's "active
 * overrides" UI naturally shows nothing — the edit is now in the file.
 */
export async function patchSource(
  locale: string,
  namespace: string,
  keyPath: string,
  value: string,
): Promise<MutationResponse> {
  const res = await fetch(API_ROUTES.i18n.sourceWrite, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, namespace, keyPath, value }),
  })
  // 409 = the parity guard refused a single-locale write of a sibling-absent
  // key. Callers (Import) catch HttpError and branch on status.
  if (!res.ok) throw new HttpError(res.status, await readError(res))
  const data = (await res.json()) as SourceMutationResponse
  return {
    locale: data.locale,
    key: splitFlat(data.namespace, data.keyPath),
    value: data.value,
    version: data.version,
    overrides: {},
  }
}

/**
 * Create or rewrite a key across BOTH locales in one atomic request — the
 * parity-preserving path for NEW keys. `values` must carry every locale.
 */
export async function patchSourceBoth(
  namespace: string,
  keyPath: string,
  values: { en: string; ar: string },
): Promise<{ version: number }> {
  const res = await fetch(API_ROUTES.i18n.sourceWrite, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ namespace, keyPath, values }),
  })
  if (!res.ok) throw new HttpError(res.status, await readError(res))
  const data = (await res.json()) as { version: number }
  return { version: data.version }
}

export async function deleteSource(locale: string, namespace: string, keyPath: string): Promise<MutationResponse> {
  const res = await fetch(API_ROUTES.i18n.sourceWrite, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale, namespace, keyPath }),
  })
  if (!res.ok) throw new Error(`DELETE failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as SourceMutationResponse
  return {
    locale: data.locale,
    key: splitFlat(data.namespace, data.keyPath),
    version: data.version,
    overrides: {},
  }
}
