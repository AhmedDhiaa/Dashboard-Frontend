/**
 * Pure tree operations on a `PageSchema`.
 *
 * Every mutating function takes the current schema, returns a fresh one,
 * and never aliases a node from the input into the output (the whole
 * subtree is `structuredClone`d before mutation). The user-facing
 * trade-off — full deep clone vs. structural sharing on the path-only —
 * decision: full clone is the chosen baseline; we'll tighten if
 * benchmarks demand.
 *
 * Path semantics (see ./types.ts for the exhaustive type):
 *   - The first segment is always `{kind:"root", index}` and points at
 *     `schema.blocks[index]`.
 *   - Subsequent segments descend INTO the previous block:
 *       blocks      → card/grid `.blocks[]`
 *       tab         → tabs `.tabs[find tabId].blocks[]`
 *       item        → accordion `.items[find itemId].blocks[]`
 *       action-blocks → button `.button.action.blocks[]`
 */

import type { PageSchema } from "../../schema/page-schema"
import type { BlockSchema } from "../../schema/block-schema"
import { asBlockNode, type BlockNode, type BlockPath, type PathLookupResult, type PathSegment } from "./types"
import { walkBlocks } from "./walker"
import { getContainerSlots } from "./container-helpers"
import { generateBlockId, regenerateIdsRecursive } from "./id-generator"
import { canDropInto } from "./validation"

// ─── Read-only navigation ──────────────────────────────────────────────────

export function findBlockById(schema: PageSchema, id: string): PathLookupResult | null {
  let result: PathLookupResult | null = null
  walkBlocks(schema, ({ block, path, parent }) => {
    if (asBlockNode(block).id !== id) return undefined
    result = {
      block,
      path,
      parent,
      // Root-level blocks have no parent slot — the root segment is a
      // navigation entry, not a slot identity.
      parentSlot: path.length > 1 ? path[path.length - 1]! : null,
    }
    return false
  })
  return result
}

export function getBlockAt(schema: PageSchema, path: BlockPath): BlockSchema | null {
  if (path.length === 0) return null
  const first = path[0]!
  if (first.kind !== "root") return null
  let current: BlockSchema | undefined = schema.blocks[first.index]
  for (let i = 1; i < path.length; i++) {
    if (!current) return null
    current = descend(current, path[i]!)
  }
  return current ?? null
}

function descend(block: BlockSchema, seg: PathSegment): BlockSchema | undefined {
  const node = asBlockNode(block)
  switch (seg.kind) {
    case "root":
      return undefined // only valid as first segment, handled outside
    case "blocks":
      return node.blocks?.[seg.index]
    case "tab": {
      const tab = node.tabs?.find(t => t.id === seg.tabId)
      return tab?.blocks[seg.index]
    }
    case "item": {
      const item = node.items?.find(it => it.id === seg.itemId)
      return item?.blocks[seg.index]
    }
    case "action-blocks":
      return node.button?.action?.blocks?.[seg.index]
  }
}

// ─── Mutating operations (return new schema) ───────────────────────────────

/**
 * Locate the array a non-root path segment writes into, inside an
 * already-cloned tree. Returns the live array so the caller can splice;
 * one helper per slot kind keeps each below the cyclomatic-complexity
 * cap and lets the inner branches narrow on their specific shape.
 */
function getSlotArray(parent: BlockNode, seg: PathSegment): BlockSchema[] | null {
  if (seg.kind === "blocks") return getBlocksSlotArray(parent)
  if (seg.kind === "tab") return getTabSlotArray(parent, seg.tabId)
  if (seg.kind === "item") return getItemSlotArray(parent, seg.itemId)
  if (seg.kind === "action-blocks") return getActionSlotArray(parent)
  return null
}

function getBlocksSlotArray(parent: BlockNode): BlockSchema[] {
  if (!parent.blocks) parent.blocks = []
  return parent.blocks
}

function getTabSlotArray(parent: BlockNode, tabId: string): BlockSchema[] | null {
  const tab = parent.tabs?.find(t => t.id === tabId)
  if (!tab) return null
  if (!tab.blocks) tab.blocks = []
  return tab.blocks
}

function getItemSlotArray(parent: BlockNode, itemId: string): BlockSchema[] | null {
  const item = parent.items?.find(it => it.id === itemId)
  if (!item) return null
  if (!item.blocks) item.blocks = []
  return item.blocks
}

function getActionSlotArray(parent: BlockNode): BlockSchema[] | null {
  const action = parent.button?.action
  if (!action) return null
  if (!action.blocks) action.blocks = []
  return action.blocks
}

function navigateMutable(schema: PageSchema, path: BlockPath): BlockSchema | null {
  if (path.length === 0) return null
  const first = path[0]!
  if (first.kind !== "root") return null
  let current: BlockSchema | undefined = schema.blocks[first.index]
  for (let i = 1; i < path.length; i++) {
    if (!current) return null
    current = descend(current, path[i]!)
  }
  return current ?? null
}

export function setBlockAt(schema: PageSchema, path: BlockPath, next: BlockSchema): PageSchema {
  if (path.length === 0) return schema
  const cloned = structuredClone(schema)
  const last = path[path.length - 1]!

  if (path.length === 1) {
    if (last.kind !== "root") return schema
    if (last.index < 0 || last.index >= cloned.blocks.length) return schema
    cloned.blocks[last.index] = next
    return cloned
  }

  const parentBlock = navigateMutable(cloned, path.slice(0, -1))
  if (!parentBlock) return schema
  const arr = getSlotArray(asBlockNode(parentBlock), last)
  if (!arr) return schema
  if (last.index < 0 || last.index >= arr.length) return schema
  arr[last.index] = next
  return cloned
}

export function insertBlockAt(
  schema: PageSchema,
  parentPath: BlockPath | null,
  slot: PathSegment,
  index: number,
  newBlock: BlockSchema,
): PageSchema {
  const cloned = structuredClone(schema)

  // Root insertion — slot ignored.
  if (parentPath === null || parentPath.length === 0) {
    const safeIndex = clamp(index, 0, cloned.blocks.length)
    cloned.blocks.splice(safeIndex, 0, newBlock)
    return cloned
  }

  const parentBlock = navigateMutable(cloned, parentPath)
  if (!parentBlock) return schema
  const arr = getSlotArray(asBlockNode(parentBlock), slot)
  if (!arr) return schema
  const safeIndex = clamp(index, 0, arr.length)
  arr.splice(safeIndex, 0, newBlock)
  return cloned
}

export function removeBlockAt(schema: PageSchema, path: BlockPath): PageSchema {
  if (path.length === 0) return schema
  const cloned = structuredClone(schema)
  const last = path[path.length - 1]!

  if (path.length === 1) {
    if (last.kind !== "root") return schema
    if (last.index < 0 || last.index >= cloned.blocks.length) return schema
    cloned.blocks.splice(last.index, 1)
    return cloned
  }

  const parentBlock = navigateMutable(cloned, path.slice(0, -1))
  if (!parentBlock) return schema
  const arr = getSlotArray(asBlockNode(parentBlock), last)
  if (!arr) return schema
  if (last.index < 0 || last.index >= arr.length) return schema
  arr.splice(last.index, 1)
  return cloned
}

/**
 * Detached read of a block from `schema` followed by an
 * insert-after-remove cycle. Index adjustment matters when source and
 * destination land in the same array: removing first shifts later
 * positions left by one, so any `toIndex > fromIndex` in the same slot
 * must compensate.
 */
export function moveBlock(
  schema: PageSchema,
  fromPath: BlockPath,
  toParentPath: BlockPath | null,
  toSlot: PathSegment,
  toIndex: number,
): PageSchema {
  const block = getBlockAt(schema, fromPath)
  if (!block) return schema
  // Capture the moved subtree before we mutate the source.
  const detached = structuredClone(block)
  const afterRemove = removeBlockAt(schema, fromPath)
  const adjustedIndex = adjustIndexAfterRemoval(fromPath, toParentPath, toSlot, toIndex)
  return insertBlockAt(afterRemove, toParentPath, toSlot, adjustedIndex, detached)
}

function adjustIndexAfterRemoval(
  fromPath: BlockPath,
  toParentPath: BlockPath | null,
  toSlot: PathSegment,
  toIndex: number,
): number {
  if (fromPath.length === 0) return toIndex
  const fromLast = fromPath[fromPath.length - 1]!
  const fromParentPath = fromPath.slice(0, -1)

  // Same parent path?
  const sameParent = pathsEqual(fromParentPath, toParentPath ?? [])
  if (!sameParent) return toIndex

  // Same slot (matching kind + identifier)?
  if (!slotsEqual(fromLast, toSlot)) return toIndex

  // Same array — shift if destination is after source.
  return toIndex > fromLast.index ? toIndex - 1 : toIndex
}

function pathsEqual(a: BlockPath, b: BlockPath): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!segmentsEqual(a[i]!, b[i]!)) return false
  }
  return true
}

function segmentsEqual(a: PathSegment, b: PathSegment): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "tab" && b.kind === "tab") return a.tabId === b.tabId && a.index === b.index
  if (a.kind === "item" && b.kind === "item") return a.itemId === b.itemId && a.index === b.index
  // root / blocks / action-blocks: kind + index
  return (a as { index: number }).index === (b as { index: number }).index
}

function slotsEqual(a: PathSegment, b: PathSegment): boolean {
  // Slot identity ignores `index` (which counts children, not slots).
  if (a.kind !== b.kind) return false
  if (a.kind === "tab" && b.kind === "tab") return a.tabId === b.tabId
  if (a.kind === "item" && b.kind === "item") return a.itemId === b.itemId
  return true
}

export function duplicateBlockAt(schema: PageSchema, path: BlockPath): { schema: PageSchema; newId: string } {
  const original = getBlockAt(schema, path)
  if (!original) return { schema, newId: "" }
  const copy = regenerateIdsRecursive(original)
  const newId = asBlockNode(copy).id
  const last = path[path.length - 1]!
  if (path.length === 1) {
    return { schema: insertBlockAt(schema, null, last, last.index + 1, copy), newId }
  }
  const parentPath = path.slice(0, -1)
  return { schema: insertBlockAt(schema, parentPath, last, last.index + 1, copy), newId }
}

// ─── Drop-target enumeration ──────────────────────────────────────────────

export interface DropTarget {
  parentPath: BlockPath | null
  slot: PathSegment
  index: number
  label: string
}

/**
 * Enumerate every legal drop position for a given dragged block. Walks
 * the current tree and asks `canDropInto` for each potential target.
 * The list is small enough (O(blocks)) that the canvas can recompute it
 * on every drag-over without memoisation.
 */
export function getDropTargets(schema: PageSchema, draggedBlockPath: BlockPath): DropTarget[] {
  const targets: DropTarget[] = []

  // Root drop targets (positions 0..N inclusive).
  const ROOT_SLOT: PathSegment = { kind: "root", index: 0 }
  for (let i = 0; i <= schema.blocks.length; i++) {
    const v = canDropInto(schema, draggedBlockPath, null, ROOT_SLOT)
    if (!v.allowed) continue
    targets.push({
      parentPath: null,
      slot: ROOT_SLOT,
      index: i,
      label: i === 0 ? "Top of page" : i === schema.blocks.length ? "End of page" : `Root position ${i}`,
    })
  }

  // Container drop targets.
  walkBlocks(schema, ({ block, path }) => {
    for (const slot of getContainerSlots(block)) {
      const v = canDropInto(schema, draggedBlockPath, path, slot.segment)
      if (!v.allowed) continue
      for (let i = 0; i <= slot.blocks.length; i++) {
        targets.push({
          parentPath: path,
          slot: slot.segment,
          index: i,
          label: `Inside ${slot.slotLabel} (position ${i})`,
        })
      }
    }
  })

  return targets
}

// ─── Misc utilities ────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/** Re-export so callers needing fresh ids can import from one entry. */
export { generateBlockId }
