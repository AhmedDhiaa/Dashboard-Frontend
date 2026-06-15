/**
 * Container introspection — turns an opaque `BlockSchema` into a uniform
 * "list of slots" view the canvas tree-walker and drop-target generator
 * can iterate over.
 *
 * Slot inventory (mirrors block-schema.ts):
 *   - card        → 1 slot ("blocks")
 *   - grid        → 1 slot ("blocks")
 *   - tabs        → N slots, one per tab (slot kind "tab", keyed by tabId)
 *   - accordion   → N slots, one per item (slot kind "item", keyed by itemId)
 *   - everything else → 0 slots
 *
 * `form` is intentionally NOT a container: its schema carries `fields[]`
 * (FieldSchema, not BlockSchema) and a recursive `layout` of field
 * references. Visual-canvas drag-drop edits blocks, not fields, so form
 * exposes 0 slots here.
 *
 * The `index` field on each returned `PathSegment` is a placeholder (0).
 * Slot identity is `kind` plus, for tabs/accordion, `tabId`/`itemId`.
 * Callers writing to a slot pass an explicit insertion index separately.
 */

import type { BlockSchema } from "../../schema/block-schema"
import { asBlockNode, type ContainerKind, type PathSegment } from "./types"

export interface SlotEntry {
  /** Path segment that selects this slot (index is a placeholder, set to 0). */
  segment: PathSegment
  /** Current children of the slot. */
  blocks: BlockSchema[]
  /** Human-readable name for UI (e.g. drop-target hover labels). */
  slotLabel: string
}

export function getContainerSlots(block: BlockSchema): SlotEntry[] {
  const node = asBlockNode(block)
  switch (node.type) {
    case "card":
      return [
        {
          segment: { kind: "blocks", index: 0 },
          blocks: node.blocks ?? [],
          slotLabel: "Card body",
        },
      ]
    case "grid":
      return [
        {
          segment: { kind: "blocks", index: 0 },
          blocks: node.blocks ?? [],
          slotLabel: "Grid items",
        },
      ]
    case "tabs":
      return (node.tabs ?? []).map(tab => ({
        segment: { kind: "tab", tabId: tab.id, index: 0 },
        blocks: tab.blocks ?? [],
        slotLabel: tab.label?.en ?? tab.id,
      }))
    case "accordion":
      return (node.items ?? []).map(item => ({
        segment: { kind: "item", itemId: item.id, index: 0 },
        blocks: item.blocks ?? [],
        slotLabel: item.title?.en ?? item.id,
      }))
    default:
      return []
  }
}

export function isContainer(block: BlockSchema): boolean {
  const t = asBlockNode(block).type
  return t === "card" || t === "grid" || t === "tabs" || t === "accordion"
}

export function getContainerKind(block: BlockSchema): ContainerKind | null {
  const t = asBlockNode(block).type
  if (t === "card" || t === "grid" || t === "tabs" || t === "accordion") return t
  return null
}
