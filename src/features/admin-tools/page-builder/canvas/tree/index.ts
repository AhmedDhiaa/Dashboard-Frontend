/**
 * Public surface of the canvas tree module. Consumers (canvas state,
 * BlockTree component, drop-target renderer, drag-drop adapter) should
 * import from here, not from individual files.
 */

export type { BlockType, ContainerKind, PathSegment, BlockPath, PathLookupResult, BlockNode } from "./types"
export { asBlockNode } from "./types"

export { generateBlockId, generateTabId, generateItemId, regenerateIdsRecursive } from "./id-generator"

export type { SlotEntry } from "./container-helpers"
export { getContainerSlots, isContainer, getContainerKind } from "./container-helpers"

export type { BlockVisit, BlockVisitor } from "./walker"
export { walkBlocks } from "./walker"

export type { DropValidation } from "./validation"
export { canDropInto, isDescendantOf } from "./validation"

export type { DropTarget } from "./operations"
export {
  findBlockById,
  getBlockAt,
  setBlockAt,
  insertBlockAt,
  removeBlockAt,
  moveBlock,
  duplicateBlockAt,
  getDropTargets,
} from "./operations"
