/**
 * Block id generation for canvas operations.
 *
 * Two consumers:
 *   - the palette (instantiating a fresh block from `defaultProps`)
 *   - duplicate-block (cloning a subtree must regenerate every id so
 *     React keys and any ref-by-id consumers don't see collisions)
 *
 * Every id stays inside `kebabIdSchema`'s `^[a-z][a-z0-9-]{1,40}$` shape
 * so the schema validator accepts the produced block without a follow-up
 * sanitisation pass.
 */

import type { BlockSchema } from "../../schema/block-schema"
import { asBlockNode, type BlockNode } from "./types"

/**
 * Random kebab-safe suffix. `crypto.randomUUID()` is required by Node 18+
 * and every modern browser; the slice keeps ids short while still giving
 * us 12 hex chars (~2.8e14 values).
 *
 * 12 (not 6) so bulk regeneration stays collision-free: a 6-char suffix has
 * ~16M values, where the birthday bound puts a 1000-id batch (e.g. duplicating
 * a large subtree, or the stress test) at a few-percent collision chance. 12
 * chars drops that to ~1-in-5e8 while keeping ids well inside kebabIdSchema's
 * 40-char limit.
 */
function randomSuffix(length = 12): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length)
}

export function generateBlockId(blockType: string): string {
  return `${blockType}-${randomSuffix()}`
}

export function generateTabId(): string {
  return `tab-${randomSuffix()}`
}

export function generateItemId(): string {
  return `item-${randomSuffix()}`
}

/**
 * Deep-clone-and-rekey: returns a new block tree where every block id
 * (and every container-internal tab/item id) is freshly generated.
 *
 * Used by `duplicateBlockAt`. Unlike `structuredClone` the input is left
 * untouched — we operate on a clone before walking it.
 */
export function regenerateIdsRecursive(block: BlockSchema): BlockSchema {
  const cloned = structuredClone(block)
  rekeyInPlace(asBlockNode(cloned))
  return cloned
}

function rekeyInPlace(node: BlockNode): void {
  node.id = generateBlockId(node.type)

  // card / grid: recurse `blocks[]`
  if (Array.isArray(node.blocks)) {
    for (const child of node.blocks) rekeyInPlace(asBlockNode(child))
  }

  // tabs: regenerate each tab's id + recurse its blocks
  if (Array.isArray(node.tabs)) {
    for (const tab of node.tabs) {
      tab.id = generateTabId()
      for (const child of tab.blocks ?? []) rekeyInPlace(asBlockNode(child))
    }
  }

  // accordion: same shape as tabs but on `items[]`
  if (Array.isArray(node.items)) {
    for (const item of node.items) {
      item.id = generateItemId()
      for (const child of item.blocks ?? []) rekeyInPlace(asBlockNode(child))
    }
  }

  // button: recurse into the action's nested blocks (dialog/drawer body)
  if (node.button?.action?.blocks) {
    for (const child of node.button.action.blocks) rekeyInPlace(asBlockNode(child))
  }
}
