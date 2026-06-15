/**
 * Stable string serialisation for `BlockPath` values. dnd-kit identifiers
 * must be `string | number`; while the canvas uses raw block ids as
 * `SortableContext` ids (block ids are themselves stable strings), the
 * encoding here is a separate, future-proof primitive — useful for
 * persistence, logging, and any data-attribute that needs to round-trip
 * a path through the DOM.
 *
 * Format: pipe-separated segments, each colon-separated kind/value:
 *   - `root:N`              → schema.blocks[N]
 *   - `blocks:N`            → card/grid `.blocks[N]`
 *   - `tab:tabId:N`         → tabs `.tabs[find tabId].blocks[N]`
 *   - `item:itemId:N`       → accordion `.items[find itemId].blocks[N]`
 *   - `action-blocks:N`     → button `.button.action.blocks[N]`
 *
 * Tab/item ids are constrained to `kebabIdSchema` (`^[a-z][a-z0-9-]{1,40}$`)
 * so they can't contain `:` or `|` — no escaping is required.
 *
 * `decodePath` returns `null` on any malformed input (out-of-range index,
 * unknown kind, missing fields). The empty string maps to an empty path
 * `[]` and round-trips cleanly.
 */

import type { BlockPath, PathSegment } from "../tree/types"

const SEG_SEP = "|"
const FIELD_SEP = ":"

export function encodePath(path: BlockPath): string {
  return path.map(encodeSegment).join(SEG_SEP)
}

function encodeSegment(seg: PathSegment): string {
  if (seg.kind === "tab") return `tab${FIELD_SEP}${seg.tabId}${FIELD_SEP}${seg.index}`
  if (seg.kind === "item") return `item${FIELD_SEP}${seg.itemId}${FIELD_SEP}${seg.index}`
  // root, blocks, action-blocks
  return `${seg.kind}${FIELD_SEP}${seg.index}`
}

export function decodePath(encoded: string): BlockPath | null {
  if (encoded === "") return []
  const segments = encoded.split(SEG_SEP)
  const result: BlockPath = []
  for (const s of segments) {
    const decoded = decodeSegment(s)
    if (decoded === null) return null
    result.push(decoded)
  }
  return result
}

function decodeSegment(s: string): PathSegment | null {
  const parts = s.split(FIELD_SEP)
  if (parts.length < 2) return null
  const kind = parts[0]
  if (kind === "tab" || kind === "item") return decodeKeyed(kind, parts)
  if (kind === "root" || kind === "blocks" || kind === "action-blocks") return decodeIndexed(kind, parts)
  return null
}

function decodeKeyed(kind: "tab" | "item", parts: string[]): PathSegment | null {
  if (parts.length !== 3) return null
  const id = parts[1]!
  if (id.length === 0) return null
  const index = parseSafeInt(parts[2]!)
  if (index === null) return null
  return kind === "tab" ? { kind: "tab", tabId: id, index } : { kind: "item", itemId: id, index }
}

function decodeIndexed(kind: "root" | "blocks" | "action-blocks", parts: string[]): PathSegment | null {
  if (parts.length !== 2) return null
  const index = parseSafeInt(parts[1]!)
  if (index === null) return null
  return { kind, index }
}

function parseSafeInt(value: string): number | null {
  if (value === "" || !/^-?\d+$/.test(value)) return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}
