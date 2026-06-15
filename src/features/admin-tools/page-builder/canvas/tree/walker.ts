/**
 * Depth-first walker over the page schema's block tree.
 *
 * The visitor receives every block paired with its absolute path, the
 * depth from root (root-level blocks are depth 0), and its parent (null
 * for root-level). Returning `false` aborts the walk synchronously — used
 * by `findBlockById` to short-circuit once the target is located.
 *
 * Action-blocks (dialog/drawer bodies of a button) are NOT traversed.
 * They live behind a button block's `button.action.blocks` and represent
 * a separate editing surface; the visual canvas tree only walks the
 * card / grid / tabs / accordion containers.
 */

import type { PageSchema } from "../../schema/page-schema"
import type { BlockSchema } from "../../schema/block-schema"
import type { BlockPath } from "./types"
import { getContainerSlots } from "./container-helpers"

export interface BlockVisit {
  block: BlockSchema
  path: BlockPath
  depth: number
  parent: BlockSchema | null
}

export type BlockVisitor = (visit: BlockVisit) => boolean | void

export function walkBlocks(schema: PageSchema, visitor: BlockVisitor): void {
  const stop = { value: false }
  schema.blocks.forEach((block, idx) => {
    if (stop.value) return
    visit(block, [{ kind: "root", index: idx }], 0, null, visitor, stop)
  })
}

function visit(
  block: BlockSchema,
  path: BlockPath,
  depth: number,
  parent: BlockSchema | null,
  visitor: BlockVisitor,
  stop: { value: boolean },
): void {
  if (stop.value) return
  const result = visitor({ block, path, depth, parent })
  if (result === false) {
    stop.value = true
    return
  }
  // Recurse into every slot's children with the slot segment + child index.
  for (const slot of getContainerSlots(block)) {
    slot.blocks.forEach((child, childIdx) => {
      if (stop.value) return
      const childSeg = { ...slot.segment, index: childIdx }
      visit(child, [...path, childSeg], depth + 1, block, visitor, stop)
    })
  }
}
