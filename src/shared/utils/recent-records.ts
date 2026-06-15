/**
 * Recently-viewed records — a small localStorage ring buffer used by the
 * command palette. Written when a detail page mounts (see RecordBreadcrumb)
 * and read when the palette opens. Lives in `shared` so both `core`
 * (the detail renderer) and `features` (the palette) can import it.
 */

export interface RecentRecord {
  /** Route to the record's detail page, e.g. "/orders/123". */
  href: string
  /** Human label for the record (its name/ref). */
  title: string
  /** Already-translated entity label, e.g. "Orders". */
  entity?: string
  /** Epoch ms when it was last visited (for ordering). */
  at: number
}

const STORAGE_KEY = "acme:recent-records"
const MAX_RECORDS = 8

export function getRecentRecords(): RecentRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is RecentRecord =>
        !!r && typeof r === "object" && typeof (r as RecentRecord).href === "string" && typeof (r as RecentRecord).title === "string",
    )
  } catch {
    return []
  }
}

export function pushRecentRecord(rec: { href: string; title: string; entity?: string }, now: number): void {
  if (typeof window === "undefined") return
  try {
    const deduped = getRecentRecords().filter(r => r.href !== rec.href)
    const next = [{ ...rec, at: now }, ...deduped].slice(0, MAX_RECORDS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* localStorage unavailable (private mode / quota exceeded) — non-critical */
  }
}
