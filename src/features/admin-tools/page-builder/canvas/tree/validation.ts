/**
 * Drop-validation rules for the canvas drag-drop surface.
 *
 * Validation is *purely structural*: it knows about cycles, container
 * kinds, and slot ↔ kind compatibility. Block-type-specific bans
 * (e.g. "no table inside table") are out of scope here — when needed
 * they belong in a per-block-type whitelist that this module reads.
 *
 * Dependency direction (no cycles): validation depends only on the
 * walker, container helpers, and types. `operations.ts` then imports
 * `canDropInto` from here without forming a back-edge.
 */

import type { PageSchema } from "../../schema/page-schema"
import type { BlockSchema } from "../../schema/block-schema"
import { asBlockNode, type BlockNode, type BlockPath, type PathSegment } from "./types"
import { walkBlocks } from "./walker"
import { getContainerSlots } from "./container-helpers"

export interface DropValidation {
  allowed: boolean
  /** Stable string the UI may map to a localised hover-message. */
  reason?: string
}

const ROOT_ALWAYS_ALLOWED: DropValidation = { allowed: true }

export function canDropInto(
  schema: PageSchema,
  draggedBlockPath: BlockPath,
  targetParentPath: BlockPath | null,
  targetSlot: PathSegment,
): DropValidation {
  if (targetParentPath === null) return ROOT_ALWAYS_ALLOWED
  const dragged = getBlockByPath(schema, draggedBlockPath)
  if (!dragged) return { allowed: false, reason: "dragged-block-not-found" }
  const target = getBlockByPath(schema, targetParentPath)
  if (!target) return { allowed: false, reason: "target-parent-not-found" }

  const cycleCheck = checkCycleRules(schema, dragged, target)
  if (cycleCheck) return cycleCheck

  return checkSlotCompatibility(asBlockNode(target), targetSlot)
}

/**
 * Reject self-drop, descendant-drop (cycle), and form (which doesn't
 * accept block children at all). Returns null when the structural
 * checks all pass; the caller continues to slot compatibility.
 */
function checkCycleRules(schema: PageSchema, dragged: BlockSchema, target: BlockSchema): DropValidation | null {
  const draggedNode = asBlockNode(dragged)
  const targetNode = asBlockNode(target)
  if (draggedNode.id === targetNode.id) return { allowed: false, reason: "cannot-drop-into-self" }
  if (isDescendantOf(schema, draggedNode.id, targetNode.id)) {
    return { allowed: false, reason: "cannot-drop-into-descendant" }
  }
  if (targetNode.type === "form") return { allowed: false, reason: "form-does-not-accept-blocks" }
  return null
}

/** Map slot kind ↔ container kind plus tab/item id existence. */
function checkSlotCompatibility(target: BlockNode, slot: PathSegment): DropValidation {
  if (slot.kind === "blocks") return checkBlocksSlot(target)
  if (slot.kind === "tab") return checkTabSlot(target, slot.tabId)
  if (slot.kind === "item") return checkItemSlot(target, slot.itemId)
  if (slot.kind === "action-blocks") return checkActionBlocksSlot(target)
  // slot.kind === "root" — a non-null parent path with a "root" slot is a contradiction.
  return { allowed: false, reason: "root-slot-not-valid-as-target" }
}

function checkBlocksSlot(target: BlockNode): DropValidation {
  if (target.type !== "card" && target.type !== "grid") {
    return { allowed: false, reason: "blocks-slot-requires-card-or-grid" }
  }
  return { allowed: true }
}

function checkTabSlot(target: BlockNode, tabId: string): DropValidation {
  if (target.type !== "tabs") return { allowed: false, reason: "tab-slot-requires-tabs-block" }
  const exists = (target.tabs ?? []).some(t => t.id === tabId)
  return exists ? { allowed: true } : { allowed: false, reason: "tab-not-found" }
}

function checkItemSlot(target: BlockNode, itemId: string): DropValidation {
  if (target.type !== "accordion") return { allowed: false, reason: "item-slot-requires-accordion-block" }
  const exists = (target.items ?? []).some(it => it.id === itemId)
  return exists ? { allowed: true } : { allowed: false, reason: "item-not-found" }
}

function checkActionBlocksSlot(target: BlockNode): DropValidation {
  if (target.type !== "button") return { allowed: false, reason: "action-blocks-slot-requires-button" }
  return { allowed: true }
}

export function isDescendantOf(
  schema: PageSchema,
  potentialAncestorId: string,
  potentialDescendantId: string,
): boolean {
  if (potentialAncestorId === potentialDescendantId) return false
  // Step 1 — find the ancestor.
  let ancestor: BlockSchema | null = null
  walkBlocks(schema, ({ block }) => {
    if (asBlockNode(block).id !== potentialAncestorId) return undefined
    ancestor = block
    return false
  })
  if (!ancestor) return false
  // Step 2 — DFS the ancestor's subtree.
  return subtreeContainsId(ancestor, potentialDescendantId)
}

function subtreeContainsId(block: BlockSchema, targetId: string): boolean {
  for (const slot of getContainerSlots(block)) {
    for (const child of slot.blocks) {
      if (asBlockNode(child).id === targetId) return true
      if (subtreeContainsId(child, targetId)) return true
    }
  }
  return false
}

// ─── Internal: read-only path navigation (duplicated to keep validation ───
//                                          self-contained from operations.ts) ─

function getBlockByPath(schema: PageSchema, path: BlockPath): BlockSchema | null {
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
      return undefined
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
